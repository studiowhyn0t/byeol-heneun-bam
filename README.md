# 별 헤는 밤 — 배포 안내

누구나 접속해서 종이별을 띄울 수 있는 버전이에요.
Vercel(무료)과 Upstash Redis(무료 저장소)를 사용해요.

## 폴더 구성

- `index.html`: 화면 전체
- `fonts/gyuri.ttf`: 나눔손글씨 규리의 일기
- `api/`: 서버 기능 (별 저장, 비밀번호 확인, 관리자 기능)
- `vercel.json`, `package.json`: Vercel 설정

## 1. GitHub에 올리기

1. github.com에 로그인한 뒤 오른쪽 위 **+** 버튼을 누르고 **New repository**를 고르세요.
2. 이름은 `byeol-heneun-bam`처럼 아무거나 정하고 **Create repository**를 누르세요.
3. 만든 저장소 화면에서 **uploading an existing file**을 누르세요.
4. 이 폴더 안의 파일과 폴더(`index.html`, `fonts`, `api`, `package.json`, `vercel.json`, `README.md`)를 전부 끌어다 놓으세요.
5. **Commit changes**를 누르세요.

## 2. Vercel에 연결하기

1. vercel.com에 GitHub 계정으로 가입하거나 로그인하세요.
2. **Add New… → Project**를 누르고, 방금 만든 저장소 옆의 **Import**를 누르세요.
3. Framework Preset은 **Other** 그대로 두고 **Deploy**를 누르세요.
   첫 배포는 아직 저장소가 없어서 화면만 뜨고 별은 저장되지 않아요. 정상이에요.

## 3. 저장소(Upstash Redis) 붙이기

1. Vercel 프로젝트 화면 위쪽의 **Storage** 탭을 누르세요.
2. **Create Database**를 누르고 **Upstash for Redis**(무료 플랜)를 고른 뒤 만드세요.
3. 이 프로젝트에 연결(Connect)하세요.
   `KV_REST_API_URL`, `KV_REST_API_TOKEN` 환경변수가 자동으로 생겨요.

## 4. 관리자 비밀번호 정하기

1. 프로젝트 **Settings → Environment Variables**로 가세요.
2. 아래 두 개를 추가하세요.
   - `ADMIN_PASSWORD`: 관리자 비밀번호. 숫자 4자리로 정해야 해요. 띠지의 비밀번호 칸이 숫자 4자리이기 때문이에요. 1808을 계속 써도 되지만 남이 모르는 숫자를 권해요.
   - `PIN_SALT`: 아무 긴 문자열 (선택, 예: `my-secret-star-2026`)
3. **Deployments** 탭에서 가장 최근 배포의 **⋯ → Redeploy**를 누르세요.

## 5. 내 설정 넣기

1. 배포된 주소(예: `byeol-heneun-bam.vercel.app`)를 여세요.
2. 색지를 하나 고르고 띠지에 `관리`를 쓰세요.
3. 비밀번호 칸에 `ADMIN_PASSWORD` 숫자를 넣고 **접기**를 누르세요.
4. 관리자 화면에서 아래를 넣고 **저장**하세요.
   - **첫 화면 별에 넣을 문구**: 지금 Claude 페이지의 관리자 화면에 있는 일곱 줄을 그대로 복사해 붙여넣으세요.
   - **날짜별 오늘의 주제**
5. 북두칠성 기본 배치는 코드에 들어 있어서 따로 할 일이 없어요.
   필요하면 **첫 화면 별 위치 정하기**로 PC와 휴대폰 배치를 각각 다시 저장할 수 있어요.

## 알아두면 좋은 점

- **관리자 비밀번호 보안**: 관리자 비밀번호는 서버(Vercel 환경변수)에만 있어요. 페이지 코드를 열어봐도 보이지 않아요. 틀린 비밀번호를 8번 넣으면 그 접속지에서는 30분 동안 관리자 시도가 막혀요.
- **별 지우기**: 별을 지울 때 쓰는 4자리 비밀번호도 서버에서만 확인해요. 별을 붙인 기기의 브라우저에서만 '지우기' 버튼이 보여요.
- **도배 방지**: 같은 접속지(IP)에서 1분에 별을 6개까지만 붙일 수 있어요.
- **주제 날짜 기준**: '오늘'은 한국 시간 기준이에요.
- **새로고침 주기**: 하늘은 20초마다, 그리고 탭으로 돌아올 때마다 새로고침돼요.
