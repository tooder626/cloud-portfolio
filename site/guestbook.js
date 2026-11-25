const form = document.querySelector('#guestbook-form');
const nickname = document.querySelector('#nickname');
const message = document.querySelector('#message');
const status = document.querySelector('#guestbook-status');
const entries = document.querySelector('#guestbook-entries');
const submit = form.querySelector('button');
const config = globalThis.guestbookConfig;
const dateFormat = new Intl.DateTimeFormat('ko-KR', { dateStyle: 'medium', timeStyle: 'short' });
const fields = 'id nickname message createdAt';

async function graphql(query, variables) {
  const response = await fetch(config.endpoint, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': config.apiKey },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(10000),
  });
  if (!response.ok) throw new Error('HTTP request failed');
  const result = await response.json();
  if (result.errors?.length || !result.data) throw new Error('GraphQL request failed');
  return result.data;
}

function render(items) {
  const rows = items.map(({ nickname, message, createdAt }) => {
    const entry = document.createElement('li');
    const name = document.createElement('strong');
    const date = document.createElement('time');
    const text = document.createElement('p');
    name.textContent = nickname;
    date.dateTime = createdAt;
    date.textContent = dateFormat.format(new Date(createdAt));
    text.textContent = message;
    entry.append(name, date, text);
    return entry;
  });
  entries.replaceChildren(...rows);
}

async function refresh() {
  const data = await graphql('query Guestbook { guestbookEntries { ' + fields + ' } }');
  render(data.guestbookEntries);
  return data.guestbookEntries.length;
}

function validate(input, maximum, label) {
  const value = input.value.trim();
  input.setCustomValidity(value.length > 0 && value.length <= maximum
    ? '' : label + '은(는) 1~' + maximum + '자로 입력하세요.');
  return value;
}

if (config?.endpoint && config?.apiKey) {
  submit.disabled = true;
  status.textContent = '방명록을 불러오는 중입니다.';
  refresh().then(count => {
    status.textContent = count ? '' : '아직 등록된 글이 없습니다.';
  }).catch(() => {
    status.textContent = '방명록을 불러오지 못했습니다. 잠시 뒤 새로고침하세요.';
  }).finally(() => { submit.disabled = false; });

  for (const input of [nickname, message]) {
    input.addEventListener('input', () => input.setCustomValidity(''));
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    const variables = { nickname: validate(nickname, 20, '닉네임'), message: validate(message, 200, '메시지') };
    if (!form.reportValidity()) return;

    submit.disabled = true;
    status.textContent = '등록 중입니다.';
    try {
      await graphql(
        'mutation AddEntry($nickname: String!, $message: String!) { addGuestbookEntry(nickname: $nickname, message: $message) { ' + fields + ' } }',
        variables,
      );
      form.reset();
      status.textContent = '방명록에 등록했습니다.';
      try {
        await refresh();
      } catch {
        status.textContent = '글은 등록됐습니다. 목록을 보려면 페이지를 새로고침하세요.';
      }
    } catch {
      status.textContent = '등록 결과를 확인하지 못했습니다. 새로고침으로 확인한 뒤 다시 시도하세요.';
    } finally {
      submit.disabled = false;
    }
  });
} else {
  submit.disabled = true;
  status.textContent = '방명록 연결이 아직 설정되지 않았습니다.';
}
