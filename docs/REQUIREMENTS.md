# CMF Freight Quotation Automation System 개발 요청서

## 1. 프로젝트 개요

해상 포워딩 업무에 사용하는 **FCL 해상운임 자동 견적 웹 애플리케이션**을 개발한다.

프로젝트명: CMF Freight Quotation System

목표는 사용자가 선적항(POL), 도착항(POD), 컨테이너 규격(TYPE), 수량(QTY) 등 최소한의 정보만 입력하면, 사전에 등록된 선사별 운임과 항만 부대비용, 특수 비용 및 기타 운송비용을 조회하여 Excel 견적서 초안을 자동 생성하는 것이다.

최종 결과물은 실제 포워딩 실무에서 사용할 수 있는 웹페이지여야 한다.

모든 금액은 사용자가 등록한 데이터에 근거해야 하며, AI가 임의로 운임을 추정하거나 생성해서는 안 된다.

---

## 2. 기술 및 시스템 구조

다음 기술 스택을 우선 고려한다.

- Frontend: React + TypeScript
- Styling: Tailwind CSS
- Excel Import/Export: SheetJS 또는 ExcelJS
- 데이터 검증: Zod
- 초기 데이터 저장: 브라우저 IndexedDB
- 향후 확장: Supabase 또는 PostgreSQL
- 배포: 정적 웹 호스팅이 가능한 구조

견적 산출 로직은 UI와 분리된 독립적인 TypeScript 모듈로 개발한다.

데이터 업로드, 조건 검색, 비용 계산, 견적서 생성, 견적 이력 관리 기능을 각각 분리한다.

초기 버전은 단일 사용자용으로 구현하되, 향후 사내 다중 사용자 시스템으로 확장할 수 있도록 설계한다.

---

## 3. 주요 기능

### A. 견적 요청 입력

필수 입력:

- 수출 / 수입 구분
- POL (Port of Loading)
- POD (Port of Discharge)
- Container Type (20GP / 40GP / 40HC / 20RF / 40RF 등)
- Quantity
- Incoterms (기본값 선택 가능)

선택 입력:

- Carrier (자동 비교 / 특정 선사)
- Cargo Description
- Gross Weight
- Dangerous Goods 여부
- Reefer 여부 및 설정 온도
- Door Delivery 여부
- Pickup / Delivery Address
- Customs Clearance
- Cargo Insurance
- Quotation Customer
- Target Profit Margin
- Quotation Currency

컨테이너 TYPE과 수량은 복수 행 입력을 지원한다.

예: 20GP × 2 + 40HC × 3

### B. 해상운임 자동 검색

업로드된 CARRIER_RATE 데이터에서 다음 조건으로 검색한다.

1. POL 일치
2. POD 일치
3. Container Type 일치
4. 수출/수입 및 서비스 조건 일치
5. 견적 기준일이 운임 유효기간 이내
6. 추가 제약조건 충족

검색 결과는 선사별로 비교한다.

비교 항목:

- Carrier
- Ocean Freight
- Currency
- Transit Time
- Direct / T/S
- Free Time
- Validity
- Included / Excluded Charges
- Remark

기본 정렬은 비교 가능한 동일 조건의 총원가가 낮은 순서로 한다.

운임이 없거나 유효기간이 만료된 경우 임의 계산하지 않고 "운임 확인 필요"로 표시한다.

### C. LOCAL CHARGE 자동 계산

ORIGIN_CHARGE 및 DEST_CHARGE 데이터를 참조한다.

비용 데이터에는 다음 필드를 포함한다.

- Charge Code
- Charge Name
- Port Code
- Carrier
- Container Type
- Charge Amount
- Currency
- Charge Unit
- Valid From
- Valid To
- Included in Ocean Freight
- Charge Condition
- Remark

과금 단위는 다음을 지원한다.

- PER_CONTAINER
- PER_BL
- PER_SHIPMENT
- PER_TEU
- PER_DAY
- PER_KG
- PERCENTAGE

선사별 비용이 다른 경우 해당 선사 요율을 우선 적용한다.

이미 해상운임에 포함된 비용은 중복 계산하지 않는다.

### D. PORT별 특수비용 및 REMARK

PORT_REMARK 데이터를 참조하여 항구별 특이사항을 반영한다.

다음 유형을 지원한다.

- AUTO_CHARGE: 조건 충족 시 자동 비용 추가
- WARNING: 견적서 및 화면에 주의사항 표시
- REVIEW_REQUIRED: 담당자 검토 필요
- INFORMATION: 참고용 정보 표시

REMARK에는 적용 PORT, 선사, 컨테이너, 화물 특성, 유효기간 등을 설정할 수 있다.

금액이 확정되지 않은 특수비용은 임의 계산하지 않는다.

제재, 수출입 규제, 위험물 승인 등 법적 검토가 필요한 사항은 별도 경고하고 담당자 승인 전 최종 견적 확정을 제한한다.

### E. Incoterms 기반 비용 처리

Incoterms 2020의 EXW, FCA, FAS, FOB, CFR, CIF, CPT, CIP, DAP, DPU, DDP를 지원한다.

각 비용 항목별로 다음을 독립적으로 관리한다.

1. 실제 비용 발생 여부
2. Incoterms상 원칙적인 비용 부담자
3. 실제 계약상 부담자
4. 이번 견적에 포함할지 여부

Incoterms는 기본 규칙을 제안하는 용도로 사용한다.

견적 범위와 고객 계약 조건이 우선하며, 사용자가 각 항목의 포함 여부를 수정할 수 있어야 한다.

FOB, CFR, CIF 등은 운송방식 및 지정 장소에 따라 적용 가능성을 검증한다.

### F. 기타 비용

다음 비용을 추가하거나 제외할 수 있어야 한다.

- Export Customs Clearance
- Import Customs Clearance
- Inland Trucking
- Cargo Insurance
- Documentation Fee
- Warehouse Charge
- CFS Charge
- Handling Fee
- 기타 사용자 정의 비용

내륙운송료는 출발지, 도착지, 컨테이너 TYPE, 중량 및 운송 조건에 따라 조회한다.

요율이 없는 경우 수동 입력 또는 확인 필요 상태로 처리한다.

보험료는 사용자가 등록한 보험료율과 보험가입금액 기준에 따라 계산한다.

### G. 마진 및 견적 산출

각 비용 항목을 다음과 같이 구분한다.

- COST: 당사 원가
- SELL: 고객 제시 단가
- PROFIT: 예상 이익

마진 설정 방식:

- 정액 마진
- 원가 대비 Markup %
- 매출 대비 Gross Margin %

Markup과 Gross Margin은 다른 계산식으로 처리한다.

기본 계산식:

SELL = COST + 정액 마진

SELL = COST × (1 + Markup Rate)

SELL = COST / (1 - Gross Margin Rate)

통화별 원가와 매출을 별도로 관리한다.

환율을 적용할 경우 적용 환율, 기준일, 출처를 기록한다.

환율이 없으면 USD와 KRW를 임의로 합산하지 않는다.

원가, 마진 및 내부 계산식은 고객 제출용 견적서에 노출하지 않는다.

### H. Excel 견적서 자동 생성

두 가지 양식을 지원한다.

**1. 고객 제출용 견적서**

- 회사명 및 로고
- Quotation Number
- Quotation Date
- Customer
- POL / POD
- Incoterms
- Container Type / Quantity
- Carrier
- Ocean Freight
- Origin / Destination Local Charges
- Additional Charges
- Total Quotation Amount
- Validity
- Remark
- Terms & Conditions

**2. 내부 검토용 견적서**

고객 제출용 항목에 다음을 추가한다.

- 원가
- 판매가
- 항목별 이익
- 총 예상이익
- Markup / Margin
- 적용 환율
- 운임 출처
- 요율 유효기간
- 미확정 비용
- 검토 필요 항목

Excel 파일은 실제 셀과 숫자 데이터로 생성하며, 가능하면 수식과 셀 서식을 유지한다.

### I. 견적 관리

다음 기능을 구현한다.

- 견적번호 자동 생성
- 견적 초안 저장
- 기존 견적 복사
- 견적 수정 및 재계산
- 견적 이력 검색
- Excel 재다운로드
- 견적 생성 당시 적용된 운임 데이터 보존

견적 상태는 DRAFT / REVIEW_REQUIRED / APPROVED로 관리한다.

초기 버전의 APPROVED는 담당자가 수동으로 승인한다.

---

## 4. 데이터베이스 관리

Excel 파일을 업로드하여 운임 데이터를 등록할 수 있어야 한다.

필요한 데이터 시트:

1. CARRIER_RATE
2. ORIGIN_CHARGE
3. DEST_CHARGE
4. PORT_REMARK
5. EXTRA_COST
6. INCOTERMS
7. CUSTOMER
8. SETTINGS

각 시트의 상세 필드와 데이터 타입을 먼저 정의한다.

추가 요구사항:

- UN/LOCODE 기반 항구 관리
- BUSAN / PUSAN / KRPUS 등 항구명 정규화
- 40HQ / 40HC 등 컨테이너명 정규화
- 필수값 누락 검증
- 중복 요율 검증
- 통화 코드 검증
- 운임 유효기간 검증
- Excel 업로드 오류 표시
- 기존 데이터 덮어쓰기 전 확인
- 업로드 이력 및 버전 관리

---

## 5. 화면 구성

### Dashboard
견적 건수, 최근 견적, 미확정 견적 등을 표시한다.

### New Quotation
필수 조건을 입력하고 자동 견적을 계산한다.

### Carrier Comparison
동일 조건의 선사별 운임 및 총원가를 비교한다.

### Cost Breakdown
비용별 산출 근거, 적용 단가, 수량, 통화, 부담자를 표시한다.

### Rate Database
선사별 운임표와 LOCAL CHARGE를 조회·수정한다.

### Remark Management
PORT별 특이사항 및 비용 적용 규칙을 관리한다.

### Quotation History
기존 견적을 검색하고 수정·복사·다운로드한다.

### Settings
환율, 기본 마진, 견적서 양식, 회사 정보를 관리한다.

UI는 한국어를 기본으로 하며, 해상운송 전문 용어는 영어 표기를 유지한다.

---

## 6. 계산 정확성 및 검증

아래 사항은 필수 조건이다.

- 실제 등록되지 않은 운임을 임의로 생성하지 않는다.
- 운임 유효기간이 만료되면 경고한다.
- 컨테이너별 비용과 B/L별 비용을 구분한다.
- 운임에 포함된 LOCAL CHARGE를 이중 청구하지 않는다.
- 선사별 요율과 항구 공통 요율의 우선순위를 적용한다.
- 복수 컨테이너 입력 시 정확히 계산한다.
- 통화별 금액을 구분한다.
- 견적 제외 비용을 총액에 합산하지 않는다.
- 미확정 비용이 있으면 견적이 불완전함을 표시한다.
- 수출입 구분에 따라 비용 적용을 달리한다.
- 견적 확정 전 원가 및 판매가 검토 기능을 제공한다.

핵심 계산 로직에는 자동화 테스트를 작성한다.

---

## 7. 개발 순서

한 번에 모든 기능을 구현하지 말고 다음 단계로 나누어 개발한다.

**Phase 1: MVP**

- Excel 운임 데이터 업로드
- POL / POD / TYPE / QTY 입력
- 선사별 운임 검색 및 비교
- LOCAL CHARGE 자동 계산
- REMARK 적용
- 비용 Breakdown
- 고객 제출용 Excel 견적서 생성

**Phase 2: 업무 확장**

- Incoterms 규칙
- 통관·보험·내륙운송료
- 마진 관리
- 고객별 단가
- 견적 이력 저장

**Phase 3: 운영 시스템**

- 다중 사용자
- 승인 절차
- 중앙 데이터베이스
- 권한 관리
- 데이터 변경 이력
- 회사 표준 견적서 적용

우선 Phase 1을 실제 실행 가능한 형태로 구현한다.

구현 전에 데이터 구조, 계산 규칙, 화면 구성, 테스트 계획을 간결하게 제시하고, 이어서 작동 가능한 코드와 실행 방법을 제공한다.

단순한 화면 목업이 아니라 Excel 업로드부터 견적 산출 및 Excel 다운로드까지 실제로 동작하는 프로그램을 만들어야 한다.