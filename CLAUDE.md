# CMF TEAM 대시보드

이 폴더는 **CMF TEAM 대시보드**입니다. CMF 국제물류부 팀 내부용 웹 대시보드이며, 첫 기능은 FCL 해상운임 자동 견적(Freight Quotation System, Phase 1)입니다.
사용자가 "CMF TEAM 대시보드", "팀 대시보드", "견적 대시보드"라고 하면 이 프로젝트를 말합니다.

## 개요
- 운임 Excel(CARRIER_RATE / ORIGIN_CHARGE / DEST_CHARGE / PORT_REMARK / SETTINGS / PORT) 업로드 → POL·POD·컨테이너 입력 → 선사 비교 → 비용 Breakdown → 고객용·내부용 Excel 견적서
- 빌드 없는 순수 HTML/CSS/JavaScript. `index.html` 더블클릭 또는 GitHub Pages로 실행
- 배포 예정: GitHub 계정 KIWOONGPKW, 저장소 `cmf-team-dashboard` → https://kiwoongpkw.github.io/cmf-team-dashboard/

## 원칙 (반드시 지킬 것)
- 금액은 업로드된 데이터에서만 가져온다. 운임/비용이 없거나 만료되면 금액을 만들지 말고 PENDING("확인 필요", 견적서 TBA)으로 둔다.
- 통화별로 따로 합산한다. USD와 KRW를 임의로 합치지 않는다 (환율은 정렬 참고용).
- 운임 포함 비용(INCLUDED_IN_OF / INCLUDED_CHARGES)은 이중 청구하지 않는다.
- 고객 제출용 견적서에는 원가·마진·출처를 노출하지 않는다.
- 법적 검토(LEGAL_REVIEW=Y, DG) 항목은 담당자 승인 전 확정 불가.

## 구조
- `js/engine.js` 계산 엔진 (UI와 분리, 수정 시 `npm test` 또는 `node --test tests/engine.test.js` 실행)
- `js/schema.js` 시트 정의·업로드 검증 / `js/normalize.js` 항구·컨테이너·통화·날짜 정규화
- `js/xlsx-lite.js` Excel 읽기/쓰기 (외부 라이브러리 없음) / `js/excel-builders.js` 템플릿·견적서 양식
- `js/store.js` 브라우저 IndexedDB 저장 (Phase 3에서 중앙 DB로 교체 지점) / `js/app.js` 화면
- 테마 색상은 `css/style.css` 맨 위 `:root` 블록에서만 바꾼다 (현재 딥 틸 계열, 남색은 사용하지 않음)

## 다음 단계
- Phase 2: Incoterms 규칙, 통관·보험·내륙운송료, 마진 일괄 적용(정액/Markup/Gross Margin), 고객별 단가, 견적 이력 확장
- Phase 3: 다중 사용자, 승인 절차, 중앙 DB, 권한, 변경 이력
- 대시보드에 다른 팀 기능(선적 현황 등)을 메뉴로 추가할 수 있음
