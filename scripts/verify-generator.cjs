const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const source = fs.readFileSync(path.join(__dirname, '..', 'lottery-core.js'), 'utf8');
const context = { globalThis: {}, Math, Set, Map, Array, Number, Object, RegExp };
vm.createContext(context);
vm.runInContext(source, context, { filename: 'lottery-core.js' });
const { GAMES, PLAY_TYPES, generateRandomTicket, generatePersonalTicket, boxWays } = context.globalThis.LotteryCore;

function validateTicket(game, playType, ticket) {
  const cfg = GAMES[game];
  const expectedCount = game === 'pick3' && ['front_pair','back_pair'].includes(playType) ? 2 : cfg.count;
  assert.equal(ticket.main.length, expectedCount, `${game}/${playType}: wrong main count`);
  for (const n of ticket.main) assert.ok(Number.isInteger(n) && n >= cfg.min && n <= cfg.max, `${game}/${playType}: number out of range`);

  if (!cfg.repeats && expectedCount === cfg.count) assert.equal(new Set(ticket.main).size, ticket.main.length, `${game}: duplicate main number`);

  if (cfg.special) {
    assert.ok(Number.isInteger(ticket.special) && ticket.special >= cfg.special.min && ticket.special <= cfg.special.max, `${game}: special out of range`);
  } else {
    assert.equal(ticket.special, null, `${game}: unexpected special`);
  }

  if (game === 'pick3' || game === 'pick4') {
    if (['box','straight_box','combo'].includes(playType)) {
      const ways = boxWays(game, ticket.main);
      assert.ok(ways > 0, `${game}/${playType}: non-boxable digits`);
      assert.match(ticket.playLabel, new RegExp(`^${ways}-Way `), `${game}/${playType}: incorrect box label`);
    } else if (playType === 'front_pair') {
      assert.equal(ticket.playLabel, 'Front Pair');
    } else if (playType === 'back_pair') {
      assert.equal(ticket.playLabel, 'Back Pair');
    } else {
      assert.equal(ticket.playLabel, 'Straight');
    }
  } else {
    assert.equal(ticket.playLabel, '', `${game}: should not use Pick 3/Pick 4 wager label`);
  }
}

const plays = {};
for (const game of Object.keys(GAMES)) plays[game] = PLAY_TYPES[game]?.map(([value]) => value) || ['straight'];

for (const game of Object.keys(GAMES)) {
  for (const playType of plays[game]) {
    for (let i = 0; i < 500; i++) {
      validateTicket(game, playType, generateRandomTicket(game, playType));
      validateTicket(game, playType, generatePersonalTicket(game, playType, {
        mainFavorites: [0,1,2,3,7,11,21,33,44],
        specialFavorites: [1,7,12]
      }));
    }
    console.log(`${game}/${playType}: 1000 generated-ticket validations PASS`);
  }
}

const cases = [
  ['pick3',[1,1,2],3], ['pick3',[1,2,3],6], ['pick3',[4,4,4],0],
  ['pick4',[1,1,1,2],4], ['pick4',[1,1,2,2],6], ['pick4',[1,1,2,3],12], ['pick4',[1,2,3,4],24], ['pick4',[8,8,8,8],0]
];
for (const [game,digits,expected] of cases) assert.equal(boxWays(game,digits), expected, `${game} ${digits.join('')} box ways`);
console.log('Exact Pick 3/Pick 4 box-way classification PASS');
