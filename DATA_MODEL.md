# CMF TEAM 대시보드 - 현재 데이터 모델 명세 (Excel 업로드 템플릿)

> 기준: GitHub KIWOONGPKW/CMF-TEAM- (js/schema.js). 시트명·헤더는 대소문자/공백 무시하고 인식합니다. 헤더는 첫 10행 안에서 자동 탐색합니다.

## 공통 규칙
- 과금 단위(CHARGE_UNIT): PER_CONTAINER, PER_BL, PER_SHIPMENT, PER_TEU, PER_DAY, PER_KG, PERCENTAGE
- 컨테이너 TYPE: 20GP, 40GP, 40HC, 45HC, 20RF, 40RF, 40RH, 20OT, 40OT, 20FR, 40FR, 20TK (40HQ→40HC, 20DC→20GP 등 자동 정규화)
- 항구: UN/LOCODE(KRPUS) 또는 항구명(BUSAN/PUSAN/부산) → UN/LOCODE로 정규화, PORT 시트로 별칭 추가
- 날짜: YYYY-MM-DD, 2026.11.01, Excel 날짜 모두 인식
- 인식하는 헤더 별칭: AMOUNT→CHARGE_AMOUNT, UNIT→CHARGE_UNIT, TYPE/CNTR_TYPE→CONTAINER_TYPE, O/F→OCEAN_FREIGHT, T/T·TRANSIT_TIME→TRANSIT_DAYS, PORT→PORT_CODE, CONDITION→CHARGE_CONDITION
- 오류 행(필수값 누락·형식 오류·중복·기간 역전)은 등록 제외, 만료 요율은 경고 후 등록(견적에는 미사용)
- 중복 판정: CARRIER_RATE = DIRECTION+CARRIER+POL+POD+CONTAINER_TYPE+ROUTING+VIA 동일 & 유효기간 겹침 / CHARGE = CHARGE_CODE+PORT_CODE+CARRIER+CONTAINER_TYPE+DIRECTION+CHARGE_CONDITION 동일 & 기간 겹침

## CARRIER_RATE — 선사별 해상운임

| 컬럼 | 필수 | 형식 | 설명 |
|---|---|---|---|
| RATE_ID |  | 문자 | 요율 ID (선택) |
| DIRECTION | 필수 | EXPORT/IMPORT | EXPORT / IMPORT |
| CARRIER | 필수 | 선사명 | 선사명 (예: HMM, SM LINE, MSC) |
| POL | 필수 | 항구 UN/LOCODE 또는 항구명 | 선적항 |
| POD | 필수 | 항구 UN/LOCODE 또는 항구명 | 도착항 |
| CONTAINER_TYPE | 필수 | 컨테이너 TYPE | 20GP / 40GP / 40HC / 20RF / 40RF 등 |
| OCEAN_FREIGHT | 필수 | 숫자 | 해상운임 (컨테이너 1대당) |
| CURRENCY | 필수 | 통화 ISO 3자리 | 통화 |
| TRANSIT_DAYS |  | 숫자 | T/T (일) |
| ROUTING |  | DIRECT/T/S | DIRECT / T/S |
| VIA |  | 문자 | 환적항 (T/S일 때) |
| FREE_TIME |  | 문자 | 예: DEM 7 / DET 7 |
| VALID_FROM | 필수 | 날짜 YYYY-MM-DD | 유효 시작일 |
| VALID_TO | 필수 | 날짜 YYYY-MM-DD | 유효 종료일 |
| INCLUDED_CHARGES |  | 코드 목록(쉼표 구분) | 운임에 포함된 비용코드 (쉼표 구분, 예: BAF,LSS) |
| EXCLUDED_CHARGES |  | 문자 | 운임 불포함 안내 문구 |
| DG_ACCEPT |  | Y/N | 위험물 수용 여부 (N이면 DG 견적에서 제외) |
| REMARK |  | 문자 | 비고 |

## ORIGIN_CHARGE — 출발지 LOCAL CHARGE

| 컬럼 | 필수 | 형식 | 설명 |
|---|---|---|---|
| CHARGE_CODE | 필수 | 문자(대문자) | 비용 코드 (예: THC, DOC, WFG, SEAL, CFS) |
| CHARGE_NAME | 필수 | 문자 | 비용명 (견적서 표기) |
| PORT_CODE | 필수 | 항구 UN/LOCODE 또는 항구명 | 적용 항구 (UN/LOCODE 또는 항구명) |
| CARRIER |  | 선사명 또는 ALL(공란=공통) | 선사 (공란/ALL = 항구 공통 요율) |
| CONTAINER_TYPE |  | 컨테이너 TYPE 또는 ALL(공란) | 컨테이너 (공란/ALL = 전체) |
| DIRECTION |  | EXPORT/IMPORT/ALL(공란) | EXPORT / IMPORT / ALL(공란) |
| CHARGE_AMOUNT | 필수 | 숫자 | 금액 (PERCENTAGE는 % 값, 예 5 = 5%) |
| CURRENCY | 필수 | 통화 ISO 3자리 | 통화 (USD, KRW 등) |
| CHARGE_UNIT | 필수 | 과금단위 | PER_CONTAINER / PER_BL / PER_SHIPMENT / PER_TEU / PER_DAY / PER_KG / PERCENTAGE |
| VALID_FROM | 필수 | 날짜 YYYY-MM-DD | 유효 시작일 |
| VALID_TO | 필수 | 날짜 YYYY-MM-DD | 유효 종료일 |
| INCLUDED_IN_OF |  | Y/N | Y = 해상운임에 포함 (별도 청구 안 함) |
| CHARGE_CONDITION |  | ALL/DRY/DG/NON_DG/REEFER/DOOR | ALL / DRY / DG / NON_DG / REEFER / DOOR |
| REMARK |  | 문자 | 비고 |

## DEST_CHARGE — 도착지 LOCAL CHARGE

| 컬럼 | 필수 | 형식 | 설명 |
|---|---|---|---|
| CHARGE_CODE | 필수 | 문자(대문자) | 비용 코드 (예: THC, DOC, WFG, SEAL, CFS) |
| CHARGE_NAME | 필수 | 문자 | 비용명 (견적서 표기) |
| PORT_CODE | 필수 | 항구 UN/LOCODE 또는 항구명 | 적용 항구 (UN/LOCODE 또는 항구명) |
| CARRIER |  | 선사명 또는 ALL(공란=공통) | 선사 (공란/ALL = 항구 공통 요율) |
| CONTAINER_TYPE |  | 컨테이너 TYPE 또는 ALL(공란) | 컨테이너 (공란/ALL = 전체) |
| DIRECTION |  | EXPORT/IMPORT/ALL(공란) | EXPORT / IMPORT / ALL(공란) |
| CHARGE_AMOUNT | 필수 | 숫자 | 금액 (PERCENTAGE는 % 값, 예 5 = 5%) |
| CURRENCY | 필수 | 통화 ISO 3자리 | 통화 (USD, KRW 등) |
| CHARGE_UNIT | 필수 | 과금단위 | PER_CONTAINER / PER_BL / PER_SHIPMENT / PER_TEU / PER_DAY / PER_KG / PERCENTAGE |
| VALID_FROM | 필수 | 날짜 YYYY-MM-DD | 유효 시작일 |
| VALID_TO | 필수 | 날짜 YYYY-MM-DD | 유효 종료일 |
| INCLUDED_IN_OF |  | Y/N | Y = 해상운임에 포함 (별도 청구 안 함) |
| CHARGE_CONDITION |  | ALL/DRY/DG/NON_DG/REEFER/DOOR | ALL / DRY / DG / NON_DG / REEFER / DOOR |
| REMARK |  | 문자 | 비고 |

## PORT_REMARK — PORT별 특이사항

| 컬럼 | 필수 | 형식 | 설명 |
|---|---|---|---|
| REMARK_ID |  | 문자 | ID (선택) |
| PORT_CODE | 필수 | 항구 또는 ALL | 적용 항구 (ALL = 전체) |
| PORT_ROLE |  | POL/POD/ANY | POL / POD / ANY(공란) |
| CARRIER |  | 선사명 또는 ALL(공란=공통) | 선사 (공란 = 전체) |
| CONTAINER_TYPE |  | 컨테이너 TYPE 또는 ALL(공란) | 컨테이너 (공란 = 전체) |
| CARGO_CONDITION |  | ALL/DRY/DG/NON_DG/REEFER/DOOR | ALL / DRY / DG / NON_DG / REEFER / DOOR |
| DIRECTION |  | EXPORT/IMPORT/ALL(공란) | EXPORT / IMPORT / ALL |
| REMARK_TYPE | 필수 | AUTO_CHARGE/WARNING/REVIEW_REQUIRED/INFORMATION | AUTO_CHARGE / WARNING / REVIEW_REQUIRED / INFORMATION |
| TITLE | 필수 | 문자 | 제목 |
| MESSAGE |  | 문자 | 상세 내용 (견적서/화면 표시) |
| LEGAL_REVIEW |  | Y/N | Y = 제재·규제·위험물 승인 등 법적 검토 필요 (승인 전 확정 불가) |
| CHARGE_CODE |  | 문자(대문자) | AUTO_CHARGE 비용코드 |
| CHARGE_NAME |  | 문자 | AUTO_CHARGE 비용명 |
| CHARGE_AMOUNT |  | 숫자 | 금액 (공란 = 금액 미확정 → 확인 필요) |
| CURRENCY |  | 통화 ISO 3자리 | 통화 |
| CHARGE_UNIT |  | 과금단위 | 과금 단위 |
| VALID_FROM |  | 날짜 YYYY-MM-DD | 유효 시작일 (공란 = 제한 없음) |
| VALID_TO |  | 날짜 YYYY-MM-DD | 유효 종료일 (공란 = 제한 없음) |

## SETTINGS — 설정

| 컬럼 | 필수 | 형식 | 설명 |
|---|---|---|---|
| KEY | 필수 | 문자(대문자) | 설정 키 |
| VALUE |  | 문자 | 값 |
| DESCRIPTION |  | 문자 | 설명 |

## PORT — 항구 마스터 (UN/LOCODE 별칭)

| 컬럼 | 필수 | 형식 | 설명 |
|---|---|---|---|
| UNLOCODE | 필수 | 문자(대문자) | UN/LOCODE 5자리 |
| PORT_NAME | 필수 | 문자 | 대표 항구명 |
| ALIASES |  | 문자 | 별칭 (쉼표 구분) |

## EXTRA_COST — 기타 비용 (Phase 2) (Phase 2: 업로드·보관만, 계산 미사용)

| 컬럼 | 필수 | 형식 | 설명 |
|---|---|---|---|
| COST_CODE | 필수 | 문자(대문자) |  |
| COST_NAME | 필수 | 문자 |  |
| COST_TYPE |  | 문자(대문자) | CUSTOMS / TRUCKING / INSURANCE / DOC / WAREHOUSE / CFS / HANDLING / OTHER |
| FROM_AREA |  | 문자 |  |
| TO_AREA |  | 문자 |  |
| CONTAINER_TYPE |  | 컨테이너 TYPE 또는 ALL(공란) |  |
| AMOUNT |  | 숫자 |  |
| CURRENCY |  | 통화 ISO 3자리 |  |
| CHARGE_UNIT |  | 과금단위 |  |
| VALID_FROM |  | 날짜 YYYY-MM-DD |  |
| VALID_TO |  | 날짜 YYYY-MM-DD |  |
| REMARK |  | 문자 |  |

## INCOTERMS — Incoterms 규칙 (Phase 2) (Phase 2: 업로드·보관만, 계산 미사용)

| 컬럼 | 필수 | 형식 | 설명 |
|---|---|---|---|
| INCOTERM | 필수 | 문자(대문자) |  |
| COST_GROUP | 필수 | 문자(대문자) |  |
| PAYER | 필수 | 문자(대문자) | SELLER / BUYER |
| REMARK |  | 문자 |  |

## CUSTOMER — 고객 (Phase 2) (Phase 2: 업로드·보관만, 계산 미사용)

| 컬럼 | 필수 | 형식 | 설명 |
|---|---|---|---|
| CUSTOMER_CODE | 필수 | 문자(대문자) |  |
| CUSTOMER_NAME | 필수 | 문자 |  |
| CONTACT |  | 문자 |  |
| EMAIL |  | 문자 |  |
| DEFAULT_CURRENCY |  | 통화 ISO 3자리 |  |
| REMARK |  | 문자 |  |

## 계산 규칙 요약
1. 운임 검색: DIRECTION+POL+POD+TYPE 일치, 견적기준일이 유효기간 내, DG 화물이면 DG_ACCEPT=N 제외. 선사+ROUTING+VIA 단위로 비교
2. LOCAL CHARGE 우선순위: 선사지정+TYPE지정 > 선사지정+전체 > 공통+TYPE지정 > 공통+전체 (ORIGIN=POL 항구, DEST=POD 항구)
3. 수량: PER_CONTAINER=대수, PER_TEU=20'1/40'2/45'2.25, PER_BL=B/L 건수, PER_SHIPMENT=1, PER_KG=Gross Weight, PER_DAY=일수×대수, PERCENTAGE=같은 통화 O/F 합계×%
4. INCLUDED_IN_OF=Y 또는 CARRIER_RATE.INCLUDED_CHARGES에 있는 코드 → "운임 포함", 합계 제외
5. 운임·비용 없음/만료/금액 공란/중량·일수 미입력 → PENDING(확인 필요, 견적서 TBA), 합계 제외
6. 통화별 별도 합계, 환율은 정렬 참고용(합산 안 함)
7. PORT_REMARK: AUTO_CHARGE(조건 충족 시 비용 추가, 금액 공란=확인 필요), WARNING, REVIEW_REQUIRED, INFORMATION / LEGAL_REVIEW=Y → 승인 전 확정 불가

## 견적서 출력 (현재)
- 고객 제출용: 회사정보, Quotation No/Date/Customer/Valid Until, POL/POD, Service, Incoterms, Equipment, Carrier, Routing, T/T, Free Time, Cargo, 비용표(No/Description/Type/Unit/Q'ty/Currency/Unit Price/Amount/Remark), 통화별 TOTAL(SUMIF 수식), Remarks, Terms & Conditions
- 내부 검토용: 원가/판매가/이익/Margin%, 산출 근거, 출처(시트·행), 미확정·검토 항목
