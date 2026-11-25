import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { randomUUID } from 'node:crypto';

const dir = new URL('./', import.meta.url);
const template = await readFile(new URL('infra/guestbook.yml', dir), 'utf8');
const codeBlocks = [...template.matchAll(/^      Code: \|\r?\n((?: {8}[^\n]*\n|\r?\n)+)/gm)];
assert.equal(codeBlocks.length, 2);
const scalar = value => ({ S: value });
const util = {
  dynamodb: {
    toDynamoDB: scalar,
    toMapValues: values => Object.fromEntries(Object.entries(values).map(([key, value]) => [key, scalar(value)])),
  },
  time: { nowISO8601: () => new Date().toISOString() },
  autoId: randomUUID,
  error(message, type) { throw Object.assign(new Error(message), { errorType: type }); },
};
function resolver(block) {
  const source = block[1].replace(/^ {8}/gm, '')
    .replace(/^import .*;\r?$/m, '')
    .replaceAll('export function ', 'function ');
  return new Function('util', source + '\nreturn { request, response };')(util);
}
const [query, mutation] = codeBlocks.map(resolver);
const table = new Map();
const unpack = item => Object.fromEntries(Object.entries(item).map(([key, value]) => [key, value.S]));
function write(args) {
  const request = mutation.request({ args });
  assert.equal(request.operation, 'PutItem');
  const item = unpack({ ...request.key, ...request.attributeValues });
  assert.ok(!table.has(item.sk));
  table.set(item.sk, item);
  return mutation.response({ result: item });
}
function list() {
  const request = query.request({});
  assert.equal(request.operation, 'Query');
  assert.equal(request.scanIndexForward, false);
  assert.equal(request.consistentRead, true);
  const items = [...table.values()].filter(item => item.pk === request.query.expressionValues[':pk'].S)
    .sort((a, b) => b.sk.localeCompare(a.sk)).slice(0, request.limit);
  return query.response({ result: { items } });
}

assert.deepEqual(list(), []);
assert.throws(() => write({ nickname: '    ', message: 'hello' }), { errorType: 'InvalidInput' });
assert.throws(() => write({ nickname: '가'.repeat(21), message: 'hello' }), { errorType: 'InvalidInput' });
assert.throws(() => write({ nickname: '테스트', message: '가'.repeat(201) }), { errorType: 'InvalidInput' });
const first = write({ nickname: '  테스트  ', message: '  반가워요  ' });
assert.equal(first.nickname, '테스트');
assert.equal(first.message, '반가워요');
assert.equal(first.sk, first.createdAt + '#' + first.id);
assert.equal(list()[0].id, first.id);
assert.equal(write({ nickname: '가'.repeat(20), message: '가'.repeat(200) }).nickname.length, 20);
for (let i = 0; i < 12; i++) write({ nickname: '테스트', message: '항목 ' + i });
const listed = list();
assert.equal(listed.length, 10);
assert.deepEqual(listed.map(x => x.sk), listed.map(x => x.sk).sort((a, b) => b.localeCompare(a)));
assert.throws(() => query.response({ error: { type: 'LocalFailure' } }), { errorType: 'LocalFailure' });
assert.throws(() => mutation.response({ error: { type: 'LocalFailure' } }), { errorType: 'LocalFailure' });
console.log('PASS: empty list, mutation, trimming, boundary validation, sort, latest 10, data source errors');
if (!process.argv.includes('--serve')) process.exit();

table.clear();
const serves = {
  '/': ['index.html', 'text/html; charset=utf-8'],
  '/styles.css': ['styles.css', 'text/css; charset=utf-8'],
  '/guestbook.js': ['guestbook.js', 'text/javascript; charset=utf-8'],
};
const server = createServer(async (req, res) => {
  if (req.url === '/guestbook-config.js') {
    res.writeHead(200, { 'content-type': 'text/javascript; charset=utf-8' })
      .end("globalThis.guestbookConfig = {endpoint: '/graphql', apiKey: 'local-preview'};");
    return;
  }
  if (req.url === '/graphql' && req.method === 'POST') {
    res.setHeader('content-type', 'application/json; charset=utf-8');
    if (req.headers['x-api-key'] !== 'local-preview') return res.writeHead(401).end('{}');
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks));
      const data = body.query.includes('addGuestbookEntry')
        ? { addGuestbookEntry: write(body.variables) }
        : { guestbookEntries: list() };
      return res.end(JSON.stringify({ data }));
    } catch (error) {
      return res.end(JSON.stringify({ errors: [{ message: error.message, errorType: error.errorType }] }));
    }
  }
  const asset = serves[req.url];
  if (!asset) return res.writeHead(404).end();
  res.writeHead(200, { 'content-type': asset[1] }).end(await readFile(new URL('site/' + asset[0], dir)));
});
server.listen(4189, '127.0.0.1', () => console.log('Local resolver preview at http://127.0.0.1:4189/'));

