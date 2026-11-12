/* CMF TEAM 대시보드 - 견적 자동화 개발 로드맵
 * 진행 상황이 바뀌면 이 파일의 status / done / note만 고치면 화면에 반영됩니다.
 * status: 'done' 완료 · 'progress' 진행 중 · 'todo' 예정
 */
(function (root) {
  root.CMF = root.CMF || {};
  root.CMF.ROADMAP = {
    title: 'CMF 견적 자동화 개발 단계',
    goal: '단순히 선사별 운임을 조회하는 수준이 아니라, 운임표를 업로드하면 조건에 맞는 비용을 자동으로 조합하고, 검증된 견적서 초안을 생성하는 구조로 완성하는 것이 목표입니다.',
    order: '1~3단계를 먼저 완성하고 5단계 Excel 출력까지 연결해 1차 실무 버전을 만든 뒤, 4단계의 복잡한 비용 조건과 6단계 운영 기능을 고도화합니다.',
    updated: '2026-11-12',
    stages: [
      {
        no: 1, title: '백데이터 표준화', priority: true, status: 'progress',
        desc: '선사별 해상운임, 항만 부대비용, PORT별 특이사항, 기타 비용을 동일한 엑셀 규격으로 정리.',
        criteria: '업로드용 Excel 템플릿 및 컬럼 정의 확정',
        tasks: [
          { text: '업로드용 Excel 템플릿 · 컬럼 정의 (사용안내 시트 포함)', done: true },
          { text: '실제 선사 운임표를 템플릿 규격으로 정리', done: false },
          { text: '항만 부대비용(THC·DOC·WFG 등) 표준 코드 확정', done: false }
        ],
        link: 'upload'
      },
      {
        no: 2, title: '데이터 업로드 기능 검증', status: 'progress',
        desc: 'Excel 업로드 후 선사·항구·컨테이너별 요율이 정확히 등록되는지 확인. 중복 운임, 만료 운임, 필수값 누락 검증.',
        criteria: '업로드 오류 검출 및 DB 조회 정상 작동',
        tasks: [
          { text: '필수값·중복·통화·유효기간 검증, 항구명/컨테이너명 정규화', done: true },
          { text: '업로드 이력 · 버전 복원', done: true },
          { text: '실제 운임표 업로드 테스트', done: false }
        ],
        link: 'rates'
      },
      {
        no: 3, title: '견적 산출 엔진 완성', status: 'progress',
        desc: 'O/F + Origin/Destination Local Charge + Special Charge를 계산. B/L당 비용과 컨테이너당 비용을 구분하고, 중복 청구 방지.',
        criteria: '수작업 견적과 자동 견적 결과 일치',
        tasks: [
          { text: '선사별 비교 · LOCAL CHARGE · PORT REMARK 자동 계산', done: true },
          { text: 'B/L·컨테이너·TEU 단위 구분, 운임 포함 비용 중복 청구 방지', done: true },
          { text: '자동화 테스트 19건 통과', done: true },
          { text: '수작업 견적과 결과 대조', done: false }
        ],
        link: 'quote'
      },
      {
        no: 4, title: 'Incoterms 및 기타 비용 연동', status: 'todo',
        desc: 'EXW, FOB, CFR, CIF, DAP 등 조건에 따라 비용 부담자와 견적 포함 항목 구분. 내륙운송·통관·보험료 확장.',
        criteria: '조건별 비용 반영과 미확정 항목 경고',
        tasks: [
          { text: 'Incoterms 입력 및 견적서 표기', done: true },
          { text: 'Incoterms별 비용 부담자 자동 제안 (INCOTERMS 시트)', done: false },
          { text: '내륙운송 · 통관 · 보험료 (EXTRA_COST 시트)', done: false },
          { text: '마진 일괄 적용 (정액 / Markup % / Gross Margin %)', done: false }
        ],
        link: null
      },
      {
        no: 5, title: 'CMF 견적서 Excel 출력', status: 'progress',
        desc: '실제 회사 양식에 고객정보, 운임, 부대비용, REMARK, 견적 유효기간 등을 자동 입력. 내부 원가표와 고객 제출용 견적서를 분리.',
        criteria: '고객 제출 가능한 Excel 초안 출력',
        tasks: [
          { text: '고객 제출용 / 내부 검토용 Excel 분리 출력', done: true },
          { text: 'CMF 실제 견적서 양식(로고·서식) 적용', done: false }
        ],
        link: 'history'
      },
      {
        no: 6, title: '실무 테스트 및 운영 전환', status: 'todo',
        desc: '실제 완료된 견적 사례 10~20건을 대상으로 결과 비교. 오류 수정 후 승인 절차와 데이터 갱신 담당자 지정.',
        criteria: '주요 테스트 통과 및 담당자 검토 후 실무 사용',
        tasks: [
          { text: '실제 견적 사례 10~20건 결과 비교', done: false },
          { text: '승인 절차 · 데이터 갱신 담당자 지정', done: false },
          { text: '팀 공용 데이터(중앙 DB) 전환 검토', done: false }
        ],
        link: null
      }
    ]
  };
})(typeof self !== 'undefined' ? self : this);
