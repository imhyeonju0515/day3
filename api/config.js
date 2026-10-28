// Vercel 서버리스 함수: GET /api/config → 화면이 쓸 공개 설정(카카오 지도 JavaScript 키)
// 카카오 JavaScript 키는 브라우저에서 보이는 값이라 숨길 수는 없지만, 코드에 박지 않고 환경변수 KAKAO_JS_KEY 로 받습니다.
// 키가 보호되는 방식은 카카오 개발자 사이트에 등록한 "사이트 도메인"입니다.
module.exports = (req, res) => {
  res.setHeader('Cache-Control', 's-maxage=60');
  return res.status(200).json({ kakaoKey: process.env.KAKAO_JS_KEY || null });
};
