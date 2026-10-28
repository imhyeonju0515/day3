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

const tools = [find_spots_tool];
const handlers = { find_spots };

module.exports = { find_spots, find_spots_for_map, find_spots_tool, tools, handlers };
