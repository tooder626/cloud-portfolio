# 자기소개 웹앱 1주차 배포

`site/`에 정적 포트폴리오가 있습니다. `site/index.html`을 브라우저에서 열어 확인할 수 있습니다. 프로젝트 세부 역할과 성과, 전공명 및 공개 이메일은 확인 후 추가합니다. 3주차 방명록은 아래 AppSync·DynamoDB 구성으로 동작합니다.

## Codex · GitHub · AWS 작업 흐름

1. 이 폴더를 독립 프로젝트로 Codex에서 열고 `site/`를 수정합니다.
2. GitHub 개인 계정에 `cloud-portfolio-week1` 비공개 저장소를 만들고 이 프로젝트의 `main` 브랜치를 연결합니다. 이미 연결했다면 주소를 `git remote -v`로 확인합니다.
3. AWS CLI v2에서 배포 권한이 있는 프로필에 로그인하고 아래 명령을 실행합니다. AWS IAM Identity Center를 쓰는 프로필이라면 먼저 `aws sso login --profile <프로필>`을 실행합니다.

```powershell
pwsh -File .\infra\deploy.ps1 -Region ap-northeast-2 -Profile '<프로필>'
```

배포 스크립트가 CloudFormation에서 S3, CloudFront, OAC, 버킷 정책을 구성하고 `site/`의 웹 파일을 업로드합니다. CloudFront 캐시 무효화와 배포가 완료되면 CloudFront 홈과 CSS의 HTTP 200, S3 객체 URL의 HTTP 403을 검사합니다. CloudFront 배포 URL은 스크립트 출력과 CloudFormation 스택의 **Outputs → CloudFrontUrl**에서 확인할 수 있습니다.

브라우저 콘솔에서 배포할 경우 [CloudFormation](https://console.aws.amazon.com/cloudformation/)에서 `infra/hosting.yml`을 올려 `cloud-portfolio-week1` 스택을 생성합니다. 스택의 **Outputs → BucketName**에 표시된 버킷의 루트에 `site/index.html`, `site/styles.css`를 업로드합니다. 업로드 전에 CloudFront URL을 열어 403이 캐시됐다면 `/`, `/index.html`, `/styles.css`를 무효화한 후 재검증합니다.

## 제출용 화면

| 화면 | 표시할 항목 |
| --- | --- |
| 개발환경 | Codex에서 프로젝트를 연 화면, GitHub 저장소 `main`의 파일과 최신 커밋, AWS CloudFormation 스택과 Outputs |
| S3 권한 | **Permissions → Block public access**의 네 설정, **Bucket policy**의 CloudFront 서비스 주체와 배포 ARN 조건 |
| CloudFront | 배포 도메인과 **Origins**에 연결된 OAC, OAC의 요청 서명 설정 |
| 접속 결과 | CloudFront의 포트폴리오 화면과 S3 직접 객체 URL의 `AccessDenied` |

[AWS의 CloudFront OAC 구성 문서](https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/private-content-restricting-access-to-s3.html)

## 3주차 방명록

`infra/guestbook.yml`은 DynamoDB 테이블(`pk`, `sk`), AppSync GraphQL API와 데모 키, 리졸버 두 개를 정의합니다. AppSync 역할은 이 테이블의 `dynamodb:Query`, `dynamodb:PutItem`만 허용합니다. `pk`는 `GUESTBOOK`, `sk`는 UTC 작성 시각과 무작위 ID를 조합합니다. 브라우저와 리졸버가 닉네임 및 메시지 길이를 검사하고 목록은 최신순 10건으로 제한합니다.

로컬 확인은 Node.js로 실행합니다. 로컬 모드의 테스트 글은 미리보기 프로세스가 종료될 때 초기화됩니다.

```powershell
node .\resolver-preview.mjs
node .\resolver-preview.mjs --serve
```

브라우저에서 `http://127.0.0.1:4189/#guestbook`을 열면 등록과 조회를 확인할 수 있습니다. 이 검증은 AWS 호출 없이 동일한 리졸버 코드를 실행합니다.

AWS CLI에 로그인한 후 아래 명령을 실행하면 별도 3주차 스택을 배포하고 실제 API를 검증한 뒤 기존 CloudFront 사이트를 업데이트합니다.

```powershell
pwsh -File .\infra\deploy-guestbook.ps1 -Region ap-northeast-2 -Profile '<프로필>'
```

CloudFront의 `guestbook-config.js`에는 이 공개 데모의 임시 AppSync 키가 들어갑니다. 키를 가진 방문자는 방명록을 조회하고 등록할 수 있습니다. 설정 파일과 실제 키는 Git에 포함하지 않습니다. 키 만료 이후 공개 데모를 유지하려면 유효한 키를 발급하고 설정 파일을 다시 배포해야 합니다.

[3주차 디버깅 이력](WEEK3-debugging.md)

공개 MVP 주소는 https://d2rnmeea4rsxqu.cloudfront.net/#guestbook 입니다.
