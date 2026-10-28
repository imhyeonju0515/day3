// Claude 도구: 제주 관광지 목록(jeju_spots.json)에서 장소를 골라 돌려줍니다.
const { spots } = require('../jeju_spots.json');

const AREAS = ['동쪽', '서쪽', '서귀포', '제주시'];
const MAX_RESULTS = 8;

// 데이터의 area 는 '동쪽(성산)' 처럼 세분되어 있어, 괄호 앞부분으로 비교합니다.
const baseArea = (area) => String(area).split('(')[0];

function find_spots({ area, indoor } = {}) {
  if (!AREAS.includes(area)) {
    return { error: 'area 는 ' + AREAS.join(' · ') + ' 중 하나여야 합니다.' };
  }
  const found = spots
    .filter((s) => baseArea(s.area) === area)
    .filter((s) => indoor === undefined || indoor === null || s.indoor === indoor)
    .slice(0, MAX_RESULTS)
    // 좌표는 화면용이라 뺍니다. 설명은 description → desc → type 순으로 있는 값을 씁니다.
    .map((s) => ({
      name: s.name,
      area: s.area,
      indoor: s.indoor,
      description: s.description || s.desc || s.type || '',
    }));
  return { count: found.length, spots: found };
}

// ---- 지도 표시용 ----
// 데이터에 좌표가 없어서 지역 중심 좌표 근처에 흩뿌려 찍습니다(실제 위치가 아닌 근사값).
const AREA_CENTER = { 동쪽: [33.46, 126.88], 서쪽: [33.36, 126.3], 서귀포: [33.25, 126.56], 제주시: [33.51, 126.52] };

// 이름으로 만든 값이라 같은 장소는 항상 같은 자리에 찍힙니다. 결과는 -1 ~ 1.
const hash = (text, salt) => {
  let h = salt;
  for (const ch of text) h = (h * 31 + ch.charCodeAt(0)) % 1000003;
  return (h % 2001) / 1000 - 1;
};

function find_spots_for_map(input) {
  const result = find_spots(input);
  if (result.error) return result;
  const [lat, lon] = AREA_CENTER[input.area];
  return {
    count: result.count,
    spots: result.spots.map((s) => ({
      ...s,
      lat: +(lat + hash(s.name, 7) * 0.05).toFixed(4),
      lon: +(lon + hash(s.name, 13) * 0.07).toFixed(4),
    })),
  };
}

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

const tools = [find_spots_tool];
const handlers = { find_spots };

module.exports = { find_spots, find_spots_for_map, find_spots_tool, tools, handlers };
