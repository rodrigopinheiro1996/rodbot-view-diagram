import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { gerarHtml, RAIZ } from '../../scripts/build.mjs';

test('rodbot-final.html está em sincronia com src/', () => {
  assert.equal(
    gerarHtml(),
    readFileSync(join(RAIZ, 'rodbot-final.html'), 'utf8'),
    'rodbot-final.html difere de src/ — rode npm run build; não edite o HTML à mão',
  );
});
