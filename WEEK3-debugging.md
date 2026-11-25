# 3주차 자기소개 웹앱 디버깅 이력

## 테스트 환경

- 프런트엔드: 기존 포트폴리오의 소개, 프로젝트, 연락처에 방명록을 추가했습니다.
- AWS 구성: 서울 리전 AppSync GraphQL, DynamoDB, 방명록 테이블 한 개에만 접근하는 AppSync 서비스 역할을 CloudFormation으로 정의했습니다.
- 로컬 검증: Node.js에서 동일한 AppSync 리졸버 소스를 메모리 저장소에 연결해 동작을 확인했습니다.

## 재현과 해결

| 증상 | 원인 | 처리 및 확인 |
| --- | --- | --- |
| 공백 닉네임으로 등록을 요청할 때 HTTP 상태는 200이지만 글이 저장되지 않았습니다. | GraphQL은 요청 본문을 처리한 뒤에도 필드 오류를 응답의 `errors` 배열로 전달할 수 있습니다. 공백을 제거하면 닉네임 길이가 0이 됩니다. | 브라우저는 공백 제거 후 길이를 검사하고, HTTP 상태와 GraphQL `errors`를 모두 확인합니다. 리졸버도 같은 검사를 실행합니다. 로컬에서 HTTP 200과 `InvalidInput`을 재현하고, 정상 요청은 같은 경로에서 저장 후 조회되는 것을 확인했습니다. |
| 접근 권한이 제한된 workspace에서 개인 저장소에 대해 `git status`가 작업 트리를 열지 못했습니다. | 개인 저장소가 기본 쓰기 경로인 `26-2Cap` 밖에 있습니다. | 별도 작업 폴더에서 준비·검증한 파일을 개인 저장소에 적용했습니다. |
| 첫 AWS 콘솔 연결에서 Chrome 접근이 중단됐습니다. | 브라우저 제어 도구가 현재 URL을 확인하지 못했습니다. | 사용자가 서울 리전 콘솔을 열어 둔 뒤 다시 연결해 CloudFormation 파일 업로드와 IAM 승인 단계까지 진행했습니다. |

## 로컬 검증 결과

| 검증 항목 | 결과 |
| --- | --- |
| 초기 빈 목록 | 빈 배열 반환 |
| 등록 후 조회 | 방금 생성한 글의 ID, 닉네임, 메시지를 다시 조회 |
| 입력 검증 | 공백 및 21자 닉네임, 201자 메시지 거부. 20자 닉네임, 200자 메시지 허용 |
| 정렬과 표시 건수 | 정렬 키 내림차순으로 최신 글 최대 10건 반환 |
| 데이터 소스 오류 | 조회 및 등록 리졸버가 GraphQL 오류로 변환 |
| 정적 파일 | HTML, CSS, 방명록 스크립트, 로컬 설정 모두 HTTP 200 |

## AWS 배포 및 최종 확인

2026년 11월 25일 서울 리전에 cloud-portfolio-week3 스택을 배포하고 CREATE_COMPLETE를 확인했습니다. 스키마와 등록·조회 리졸버, DynamoDB 데이터 소스 및 IAM 역할 생성이 성공했습니다.

실제 AppSync API에서 공백 닉네임 요청을 보냈을 때 HTTP 200 응답 안의 GraphQL errors와 InvalidInput을 확인했습니다. 정상 입력으로 테스트 글을 등록한 뒤 동일한 ID가 조회되는 것을 확인했습니다.

공개 CloudFront 웹페이지에서 닉네임과 메시지를 입력하고 등록 버튼을 눌렀습니다. 입력란이 비워지고 성공 안내와 새 글이 표시됐습니다. 페이지를 새로고침한 뒤에도 동일한 글이 표시되어 DynamoDB 저장을 확인했습니다. 최신순 목록, 프로젝트 상세 열기와 GitHub 링크를 확인했고 브라우저 콘솔 오류는 없었습니다.

S3 객체를 교체해도 CloudFront가 이전 파일을 캐시할 수 있어 /, /index.html, /styles.css, /guestbook.js, /guestbook-config.js를 무효화했습니다. 무효화 완료 후 네 파일이 모두 HTTP 200이고 방명록이 실제 API 데이터를 조회하는 것을 확인했습니다.

## 제출 화면

- mvp-live-home.jpg — 자기소개 및 소개
- mvp-live-project.jpg — 프로젝트 상세
- mvp-live-guestbook.jpg — 공개 사이트의 글 등록과 목록 갱신
- aws-stack-complete.jpg — AppSync API 배포 완료
- aws-dynamodb-keys.jpg — pk 파티션 키와 sk 정렬 키

## 확인 주소

https://d2rnmeea4rsxqu.cloudfront.net/#guestbook

AppSync 데모 API 키는 유효 기간이 있는 공개 클라이언트 키입니다. 만료 후에는 새 키 발급과 guestbook-config.js 갱신이 필요합니다. 등록·조회 API는 해당 키를 가진 방문자가 이용할 수 있습니다.

