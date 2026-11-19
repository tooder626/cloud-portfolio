# 자기소개 웹앱 1주차 배포

`site/`에 정적 포트폴리오가 있습니다. `site/index.html`을 브라우저에서 열어 확인할 수 있습니다. 프로젝트 세부 역할과 성과, 전공명 및 공개 이메일은 확인 후 추가합니다. 웹 서버, PostgreSQL 및 공유 방명록은 이번 정적 배포 이후 단계입니다.

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
