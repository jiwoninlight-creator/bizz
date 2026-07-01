# BIZZ — 학교 생활 통합 웹앱

## 프로젝트 개요
학생들이 학교 생활에서 겪는 4가지 불편(선생님 찾기, 일정 관리, 메시지, 자료 보관)을 해결하는 웹앱.

## 기술 스택
- 프론트엔드: Next.js 14 (App Router) + TypeScript + Tailwind CSS + shadcn/ui
- 백엔드/DB/인증/스토리지: Supabase
- 파일 저장: Supabase Storage (PDF, HWP, 이미지)
- 배포: Vercel
- 모바일: PWA 대응

## 사용자 역할
- student: 학생 (기본)
- teacher: 선생님
- admin: 관리자 (조원들)

## 학년 판별 규칙
학교 이메일 형식: `{기수}xxx@학교도메인.kr`
- 기수 43 → 1학년
- 기수 42 → 2학년
- 기수 41 → 3학년
판별 코드: 이메일 앞 2자리를 추출하여 (44 - 기수)로 학년 계산.
선생님 이메일은 별도 형식 (숫자로 시작 안 함) → 자동으로 teacher 역할.

## 탭 구조

### 탭 1: 선생님 찾기
- 선생님 카드 목록 (이름, 과목, 사진, 연구실 위치, 현재 상태 점)
- 검색 (이름, 과목)
- 선생님 클릭 → 상세 페이지 (시간표, 건물 모식도 위 위치, 메시지 보내기 버튼)
- 메시지 작성: 톤(정중/친근) + 목적(질문/상담/보고/연구과제) 선택 후 본문

### 탭 2: 일정 관리 (기본 화면)
- 월별 캘린더
- 일정 추가: 제목, 과목, 날짜, 종류(과제/수행평가/시험/개인), 메모, 알림
- 학년 필터 (자기 학년 자동 표시)
- D-day 강조
- (v3) 구글 클래스룸 과제 자동 동기화

### 탭 3: 수업 자료
- 카드 그리드: 과목·선생님·날짜·파일타입 표시
- 필터: 학년, 과목, 선생님
- 검색
- NEW 배지 (등록 후 7일 이내)
- 자료 등록하기 버튼 → 학생이 신청 → 관리자 승인 → 해당 학년에 공개
- 파일 타입: PDF (미리보기), 이미지 (미리보기), HWP (다운로드만), 기타 (다운로드)

## DB 테이블

### users
- id (uuid, PK)
- email (text, unique)
- name (text)
- role (text: student/teacher/admin)
- grade (int, nullable, 1~3)
- avatar_url (text, nullable)
- created_at (timestamp)

### teachers
- id (uuid, PK)
- user_id (uuid, FK → users.id, nullable)
- name (text)
- subject (text)
- office_location (text)
- photo_url (text, nullable)
- current_status (text: available/in_class/meeting/out/unknown, default unknown)
- updated_at (timestamp)

### teacher_schedules
- id (uuid, PK)
- teacher_id (uuid, FK)
- day_of_week (int, 1~5)
- period (int, 1~7)
- classroom (text)
- grade (int)
- class_number (int)

### events
- id (uuid, PK)
- user_id (uuid, FK)
- title (text)
- subject (text, nullable)
- event_date (date)
- event_type (text: assignment/exam/personal)
- memo (text, nullable)
- grade (int, nullable, NULL이면 본인만)
- created_at (timestamp)

### materials
- id (uuid, PK)
- title (text)
- subject (text)
- teacher_id (uuid, FK, nullable)
- grade (int)
- file_url (text)
- file_type (text: pdf/hwp/image/other)
- file_size (int)
- uploaded_by (uuid, FK → users.id)
- status (text: pending/approved/rejected, default pending)
- approved_by (uuid, FK, nullable)
- approved_at (timestamp, nullable)
- created_at (timestamp)

### messages
- id (uuid, PK)
- sender_id (uuid, FK)
- receiver_id (uuid, FK)
- tone (text: formal/casual)
- purpose (text: question/counsel/report/research)
- title (text)
- body (text)
- is_read (boolean, default false)
- created_at (timestamp)

## MVP 우선순위 (내일 저녁까지)
1. 인증 + 학년 자동 판별
2. 3개 탭 레이아웃
3. 탭 3: 자료 수동 업로드 + 학년 필터 + 카드 그리드
4. 탭 2: 캘린더 + 일정 수동 추가
5. 탭 1: 선생님 카드 목록 + 상세 페이지

## 디자인 가이드
- 모바일 우선 (학생들은 폰으로 씀)
- 하단 탭바 네비게이션
- 색상: 학교 분위기에 맞춰 차분하게 (파란색 계열 메인)
- shadcn/ui 컴포넌트 기본 사용