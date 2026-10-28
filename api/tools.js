// Claude 도구: 제주 관광지 목록(jeju_spots.json)에서 장소를 골라 돌려줍니다.
const { spots } = require('../jeju_spots.json');

const AREAS = ['동쪽', '서쪽', '서귀포', '제주시'];
const MAX_RESULTS = 8;

// 데이터의 area 는 '동쪽(성산)' 처럼 세분되어 있어, 괄호 앞부분으로 비교합니다.
const baseArea = (area) => String(area).split('(')[0];

// withCoords 가 true 면 지도용으로 lat/lon 을 포함하고, 좌표가 없는 장소는 뺍니다.
function pick({ area, indoor } = {}, withCoords) {
  if (!AREAS.includes(area)) {
    return { error: 'area 는 ' + AREAS.join(' · ') + ' 중 하나여야 합니다.' };
  }
  const found = spots
    .filter((s) => baseArea(s.area) === area)
    .filter((s) => indoor === undefined || indoor === null || s.indoor === indoor)
    .filter((s) => !withCoords || s.lat !== undefined)
    .slice(0, MAX_RESULTS)
    // 설명은 description → desc → type 순으로 있는 값을 씁니다. 좌표는 지도용일 때만 넣습니다.
    .map((s) => ({
      name: s.name,
      area: s.area,
      indoor: s.indoor,
      description: s.description || s.desc || s.type || '',
      ...(withCoords && { lat: s.lat, lon: s.lon }),
    }));
  return { count: found.length, spots: found };
}

const find_spots = (input) => pick(input, false);
const find_spots_for_map = (input) => pick(input, true);

// Claude 에 넘기는 도구 설명 (tools 배열에 그대로 넣으면 됩니다)
const find_spots_tool = {
  name: 'find_spots',
  description:
    '제주 관광지 목록에서 지역(동쪽 · 서쪽 · 서귀포 · 제주시)과 실내 여부로 장소를 골라 최대 8곳의 ' +
    '이름 · 지역 · 실내 여부 · 설명을 돌려준다. 목록 밖 장소는 없다. 결과에 없는 장소는 추천하거나 ' +
    '지어내지 말고, 결과가 비어 있으면 없다고 답한다.',
  input_schema: {
    type: 'object',
    properties: {
      area: {
        type: 'string',
        enum: AREAS,
        description: '찾을 지역',
      },
      indoor: {
        type: 'boolean',
        description: 'true 면 실내만, false 면 야외만. 생략하면 구분하지 않는다.',
      },
    },
    required: ['area'],
  },
};

// ---- find_restaurants: restaurants.json (scripts/restaurants.ps1 로 만든 지역별 20곳) ----
let restaurants = [];
try { restaurants = require('../restaurants.json').restaurants; } catch { /* 데이터 파일을 만들기 전 */ }

function pickRestaurants({ area, keyword } = {}, withCoords) {
  if (!AREAS.includes(area)) {
    return { error: 'area 는 ' + AREAS.join(' · ') + ' 중 하나여야 합니다.' };
  }
  if (!restaurants.length) return { error: '맛집 데이터가 아직 준비되지 않았습니다.' };
  const word = String(keyword || '').trim();
  const found = restaurants
    .filter((r) => r.area === area)
    .filter((r) => !word || (r.name + ' ' + r.category).includes(word))
    .slice(0, MAX_RESULTS)
    .map((r) => ({
      name: r.name,
      area: r.area,
      category: r.category,
      address: r.address,
      kind: 'restaurant',
      ...(withCoords && { lat: r.lat, lon: r.lon }),
    }));
  return { count: found.length, restaurants: found };
}

const find_restaurants = (input) => pickRestaurants(input, false);
const find_restaurants_for_map = (input) => pickRestaurants(input, true);

const find_restaurants_tool = {
  name: 'find_restaurants',
  description:
    '제주 맛집 목록에서 지역(동쪽 · 서쪽 · 서귀포 · 제주시)과 음식 종류 키워드로 식당을 골라 최대 8곳의 ' +
    '이름 · 지역 · 분류 · 주소를 돌려준다. 지역마다 20곳이 목록에 있고 목록 밖 식당은 없다. ' +
    '순위나 평점은 없으므로 "가장 맛있다"고 단정하지 말고, 결과에 없는 식당은 지어내지 않는다. 영업시간은 모르니 방문 전 확인을 권한다.',
  input_schema: {
    type: 'object',
    properties: {
      area: { type: 'string', enum: AREAS, description: '찾을 지역' },
      keyword: { type: 'string', description: '음식 종류나 메뉴(예: 흑돼지, 해산물, 국수). 생략하면 전체.' },
    },
    required: ['area'],
  },
};

// ---- get_weather: Open-Meteo (키 없음, 비상업·하루 1만 회 미만) ----
const AREA_CENTER = { 동쪽: [33.46, 126.88], 서쪽: [33.36, 126.3], 서귀포: [33.25, 126.56], 제주시: [33.51, 126.52] };

// WMO 날씨 코드 → 한글 설명, 비·눈 여부
const describeCode = (c) => {
  if (c === 0) return { text: '맑음', wet: false };
  if (c <= 3) return { text: '구름 조금~흐림', wet: false };
  if (c === 45 || c === 48) return { text: '안개', wet: false };
  if (c >= 51 && c <= 57) return { text: '이슬비', wet: true };
  if (c >= 61 && c <= 67) return { text: '비', wet: true };
  if (c >= 71 && c <= 77) return { text: '눈', wet: true };
  if (c >= 80 && c <= 82) return { text: '소나기', wet: true };
  if (c === 85 || c === 86) return { text: '눈 소나기', wet: true };
  if (c >= 95) return { text: '뇌우', wet: true };
  return { text: '알 수 없음', wet: false };
};

async function get_weather({ area } = {}) {
  if (!AREA_CENTER[area]) {
    return { error: 'area 는 ' + AREAS.join(' · ') + ' 중 하나여야 합니다.' };
  }
  const [lat, lon] = AREA_CENTER[area];
  const params = new URLSearchParams({
    latitude: lat,
    longitude: lon,
    current: 'temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m',
    daily: 'precipitation_probability_max,precipitation_sum,temperature_2m_max,temperature_2m_min',
    timezone: 'Asia/Seoul',
    forecast_days: 1,
  });
  try {
    const res = await fetch('https://api.open-meteo.com/v1/forecast?' + params);
    if (!res.ok) return { error: '날씨 조회 실패 (' + res.status + ')' };
    const d = await res.json();
    const w = describeCode(d.current.weather_code);
    return {
      area,
      weather: w.text,
      raining: w.wet || d.current.precipitation > 0,
      temperature_c: d.current.temperature_2m,
      feels_like_c: d.current.apparent_temperature,
      wind_kmh: d.current.wind_speed_10m,
      rain_now_mm: d.current.precipitation,
      today_rain_chance_percent: d.daily.precipitation_probability_max[0],
      today_rain_total_mm: d.daily.precipitation_sum[0],
      today_min_c: d.daily.temperature_2m_min[0],
      today_max_c: d.daily.temperature_2m_max[0],
    };
  } catch {
    return { error: '날씨 서버에 연결하지 못했습니다.' };
  }
}

const get_weather_tool = {
  name: 'get_weather',
  description:
    '제주 지역(동쪽 · 서쪽 · 서귀포 · 제주시)의 지금 날씨와 오늘 예보(기온 · 비 · 바람 · 강수확률)를 돌려준다. ' +
    '비나 눈이 오는지(raining)를 보고 실내/야외 추천을 정할 때 쓴다. 제주 밖 지역은 조회할 수 없다.',
  input_schema: {
    type: 'object',
    properties: {
      area: { type: 'string', enum: AREAS, description: '날씨를 볼 지역' },
    },
    required: ['area'],
  },
};

const tools = [find_spots_tool, find_restaurants_tool, get_weather_tool];
const handlers = { find_spots, find_restaurants, get_weather };

module.exports = {
  find_spots, find_spots_for_map, find_restaurants, find_restaurants_for_map, get_weather,
  find_spots_tool, find_restaurants_tool, get_weather_tool, tools, handlers,
};
