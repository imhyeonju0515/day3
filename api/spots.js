// Vercel 서버리스 함수: /api/spots?area=동쪽&indoor=true → 지도에 찍을 장소 목록(JSON)
const { find_spots_for_map } = require('./tools');

module.exports = (req, res) => {
  const { area, indoor } = req.query;
  const result = find_spots_for_map({
    area,
    indoor: indoor === 'true' ? true : indoor === 'false' ? false : undefined,
  });
  return res.status(result.error ? 400 : 200).json(result);
};
