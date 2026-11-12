# CMF TEAM 대시보드 - Freight Quotation System (Phase 1 MVP)

FCL 해상운임 자동 견적 웹앱입니다. 운임 Excel 업로드 → POL/POD/TYPE/QTY 입력 → 선사별 비교 → 비용 Breakdown → Excel 견적서 생성까지 브라우저에서 동작합니다.
**모든 금액은 업로드한 데이터에서만 가져옵니다.** 운임이 없거나 만료되면 금액을 만들지 않고 "확인 필요(TBA)"로 표시합니다.

---

## 1. 실행 방법

| 방법 | 순서 |
|---|---|
| **바로 열기** | 폴더의 `index.html`을 더블클릭 (Chrome/Edge). 설치 불필요 |
| **GitHub Pages** | 저장소(예: `cmf-team-dashboard`)에 폴더 내용 전체 업로드 → Settings → Pages → Branch `main` / root → `https://kiwoongpkw.github.io/cmf-team-dashboard/` |
| **로컬 서버** | `python -m http.server 8000` → `http://localhost:8000` |

처음 열면 **[샘플 데이터 불러오기]**로 화면을 확인하고, 실제 사용 시 **데이터 업로드**에서 운임 Excel을 올립니다.
데이터·견적 이력은 각 브라우저(IndexedDB)에 저장됩니다. 팀원 간 공유는 같은 운임 Excel을 각자 업로드하는 방식이며, 중앙 DB는 Phase 3 범위입니다.

테스트 실행: `node --test tests/engine.test.js` (Node 18 이상, 19개 테스트)

---

## 2. 데이터 구조 (Excel 시트)

`templates/CMF_RATE_TEMPLATE.xlsx`의 첫 시트 [사용안내]에 전체 컬럼 설명이 있습니다.

| 시트 | 핵심 컬럼 | 비고 |
|---|---|---|
| CARRIER_RATE | DIRECTION, CARRIER, POL, POD, CONTAINER_TYPE, OCEAN_FREIGHT, CURRENCY, VALID_FROM/TO | TRANSIT_DAYS, ROUTING(DIRECT/T/S), VIA, FREE_TIME, INCLUDED_CHARGES(운임 포함 비용코드), DG_ACCEPT |
| ORIGIN_CHARGE / DEST_CHARGE | CHARGE_CODE, CHARGE_NAME, PORT_CODE, CHARGE_AMOUNT, CURRENCY, CHARGE_UNIT, VALID_FROM/TO | CARRIER·CONTAINER_TYPE 공란 = 공통, INCLUDED_IN_OF, CHARGE_CONDITION(ALL/DRY/DG/NON_DG/REEFER/DOOR) |
| PORT_REMARK | PORT_CODE, REMARK_TYPE, TITLE | AUTO_CHARGE / WARNING / REVIEW_REQUIRED / INFORMATION, LEGAL_REVIEW=Y면 승인 전 확정 불가 |
| SETTINGS | KEY, VALUE | 회사정보, 견적번호 접두어, 견적 유효일수, 참고 환율, Terms |
| PORT | UNLOCODE, PORT_NAME, ALIASES | 기본 항구표(주요 50여 개)에 별칭 추가 |
| EXTRA_COST, INCOTERMS, CUSTOMER | - | Phase 2용 (업로드·보관만) |

과금 단위: `PER_CONTAINER`, `PER_BL`, `PER_SHIPMENT`, `PER_TEU`, `PER_DAY`, `PER_KG`, `PERCENTAGE`

업로드 검증: 필수값 누락, 숫자/날짜/통화코드(ISO 3자리) 형식, 유효기간 역전, 중복 요율(같은 조건 + 기간 겹침), 만료 요율 경고, 항구명(BUSAN/PUSAN/KRPUS/부산) 및 컨테이너명(40HQ/40HC) 정규화. 오류 행은 제외하고 등록하며, 덮어쓰기 전 확인하고 버전별로 복원할 수 있습니다.

## 3. 계산 규칙

1. **운임 검색**: DIRECTION + POL + POD + TYPE 일치, 견적기준일이 유효기간 이내, DG 화물이면 DG_ACCEPT=N 제외. 선사+루팅(DIRECT/T/S·VIA) 단위로 비교합니다.
2. **일부 TYPE 운임 없음** → 해당 TYPE "운임 확인 필요" (금액 생성 안 함)
3. **LOCAL CHARGE 우선순위**: 선사지정+TYPE지정 > 선사지정+전체 > 공통+TYPE지정 > 공통+전체
4. **수량**: CONTAINER = 대수, TEU = 20'×1 / 40'×2 / 45'×2.25, B/L = 입력 B/L 건수, SHIPMENT = 1, KG = Gross Weight, DAY = 일수×대수, PERCENTAGE = 같은 통화 해상운임 합계 × %
5. **이중 청구 방지**: INCLUDED_IN_OF=Y 또는 선사 운임 INCLUDED_CHARGES에 있는 코드는 "운임 포함"으로 표시하고 합계에서 뺍니다.
6. **미확정**: 금액 공란, 중량·일수 미입력, 만료된 비용 → PENDING. 합계에서 빼고 견적 불완전으로 표시합니다.
7. **통화**: 통화별로 따로 합산하며, 환율(SETTINGS)은 선사 비교 정렬 참고용으로만 씁니다. USD와 KRW를 합산하지 않습니다.
8. **정렬**: 해상운임 누락 없는 선사 우선 → 총원가 낮은 순
9. **상태**: 미확정·검토 필요·법적 검토 → REVIEW_REQUIRED, 그 외 DRAFT. APPROVED는 담당자 이름 입력(법적 검토·TBA 확인 체크)으로 수동 승인합니다.
10. **수출/수입 기본 범위**: 수출 = Origin 포함, Dest 제외 / 수입 = 반대 (화면에서 변경 가능)

## 4. 화면

Dashboard(개발 진행 요약 포함) · New Quotation · Carrier Comparison · Cost Breakdown(포함/제외, 판매가 입력) · Quotation History(열기/복사/재다운로드) · Rate Database · Remark Management · 데이터 업로드(검증·이력·복원) · Settings · 개발 로드맵

Excel 견적서
- **고객 제출용**: 판매가 기준, 원가·마진·출처 미노출, 미확정은 TBA, 통화별 SUMIF 합계 수식, 승인 전 "DRAFT" 표시
- **내부 검토용**: 원가/판매가/이익/Margin%, 산출 근거, 출처 시트·행, 미확정·검토 항목

## 5. 파일 구성

```
index.html            화면
css/style.css
js/normalize.js       항구·컨테이너·통화·날짜 정규화
js/schema.js          시트 정의·업로드 검증
js/engine.js          견적 계산 엔진 (UI와 분리)
js/xlsx-lite.js       Excel 읽기/쓰기 (외부 라이브러리 없음)
js/excel-builders.js  템플릿·견적서 양식
js/roadmap.js         개발 로드맵(6단계) 진행 현황 - status/done 값만 수정
js/store.js           브라우저 저장소 (Phase 3에서 Supabase/PostgreSQL로 교체할 부분)
js/app.js             화면 로직
tests/engine.test.js  계산 로직 자동화 테스트
templates/            빈 템플릿 / 샘플 포함 템플릿
```

## 6. 다음 단계 (Phase 2)

Incoterms 규칙(INCOTERMS 시트) · 통관·보험·내륙운송료(EXTRA_COST) · 마진 일괄 적용(정액 / Markup % / Gross Margin %) · 고객별 단가(CUSTOMER) · 환율 적용 기록

※ 요청서에 있던 React + TypeScript + Tailwind 대신, 설치 없이 바로 열리고 GitHub Pages에 파일만 올리면 되는 순수 JavaScript로 만들었습니다. 계산 엔진은 UI와 분리된 모듈이라 Phase 3에서 React로 옮길 때 그대로 재사용할 수 있습니다.
