(function attachLotteryCore(root, factory) {
  const api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api;
  if (root) root.LotteryCore = api;
}(typeof globalThis !== 'undefined' ? globalThis : this, function createLotteryCore() {
  const GAMES = {
    pick3: { name: 'Pick 3', count: 3, min: 0, max: 9, repeats: true },
    pick4: { name: 'Pick 4', count: 4, min: 0, max: 9, repeats: true },
    lotto: { name: 'Illinois Lotto', count: 6, min: 1, max: 50 },
    lucky: { name: 'Lucky Day Lotto', count: 5, min: 1, max: 45 },
    powerball: { name: 'Powerball', count: 5, min: 1, max: 69, special: { name: 'Powerball', min: 1, max: 26 } },
    mega: { name: 'Mega Millions', count: 5, min: 1, max: 70, special: { name: 'Mega Ball', min: 1, max: 24 } }
  };

  const PLAY_TYPES = {
    pick3: [['straight','Straight'],['box','Box'],['straight_box','Straight / Box'],['combo','Combo'],['front_pair','Front Pair'],['back_pair','Back Pair']],
    pick4: [['straight','Straight'],['box','Box'],['straight_box','Straight / Box'],['combo','Combo']]
  };

  function randomInteger(min, max, random = Math.random) { return min + Math.floor(random() * (max - min + 1)); }
  function shuffle(values, random = Math.random) { const out=[...values]; for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];} return out; }
  function randomDigits(count, random) { return Array.from({length:count},()=>randomInteger(0,9,random)); }
  function uniqueNumbers(config, random) { const s=new Set(); while(s.size<config.count)s.add(randomInteger(config.min,config.max,random)); return [...s].sort((a,b)=>a-b); }
  function normalizeFavorites(values,min,max){return [...new Set((values||[]).map(Number).filter(v=>Number.isInteger(v)&&v>=min&&v<=max))];}
  function weightedChoice(values,favorites,random,excluded=new Set()){const allowed=values.filter(v=>!excluded.has(v));const fav=new Set(favorites);const weights=allowed.map(v=>fav.has(v)?2.5:1);const total=weights.reduce((a,b)=>a+b,0);let cursor=random()*total;for(let i=0;i<allowed.length;i++){cursor-=weights[i];if(cursor<0)return allowed[i];}return allowed.at(-1);}
  function weightedDigits(count,favorites,random){const digits=Array.from({length:10},(_,i)=>i);return Array.from({length:count},()=>weightedChoice(digits,favorites,random));}
  function weightedUniqueNumbers(config,favorites,random){const values=Array.from({length:config.max-config.min+1},(_,i)=>config.min+i);const picked=[];const excluded=new Set();while(picked.length<config.count){const n=weightedChoice(values,favorites,random,excluded);picked.push(n);excluded.add(n);}return picked.sort((a,b)=>a-b);}

  function boxWays(game, digits) {
    const counts=[...new Map(digits.map(d=>[d,digits.filter(x=>x===d).length])).values()].sort((a,b)=>b-a);
    if(game==='pick3') { if(counts[0]===3) return 0; return counts.length===3?6:3; }
    if(game==='pick4') { if(counts[0]===4) return 0; if(counts[0]===3)return 4; if(counts[0]===2&&counts[1]===2)return 6; if(counts[0]===2)return 12; return 24; }
    return 0;
  }
  function ensureBoxable(game,digits,random){let out=[...digits];for(let i=0;i<20&&boxWays(game,out)===0;i++)out= randomDigits(game==='pick3'?3:4,random);if(boxWays(game,out)===0)out[out.length-1]=(out[0]+1)%10;return out;}
  function playLabelFor(game,playType,main){
    if(game!=='pick3'&&game!=='pick4')return '';
    if(game==='pick3'&&playType==='front_pair')return 'Front Pair';
    if(game==='pick3'&&playType==='back_pair')return 'Back Pair';
    if(['box','straight_box','combo'].includes(playType)){const ways=boxWays(game,main);const base=playType==='box'?'Box':playType==='combo'?'Combo':'Straight / Box';return `${ways}-Way ${base}`;}
    return 'Straight';
  }

  function buildMain(game,playType,random,favorites=null){
    const config=GAMES[game];
    if(game==='pick3'&&['front_pair','back_pair'].includes(playType)) return favorites?weightedDigits(2,favorites,random):randomDigits(2,random);
    if(config.repeats){let main=favorites?weightedDigits(config.count,favorites,random):randomDigits(config.count,random);if(['box','straight_box','combo'].includes(playType)) main=ensureBoxable(game,main,random);return main;}
    return favorites?weightedUniqueNumbers(config,favorites,random):uniqueNumbers(config,random);
  }

  function generateRandomTicket(game,playType='straight',random=Math.random){const config=GAMES[game];const main=buildMain(game,playType,random);const special=config.special?randomInteger(config.special.min,config.special.max,random):null;return {main,special,playLabel:playLabelFor(game,playType,main)};}

  function rangeBand(number,min,max){const span=max-min+1;return Math.min(2,Math.floor(((number-min)*3)/span));}
  function diversityScore(ticket,config,mainFavorites,specialFavorites){const odd=ticket.main.filter(n=>n%2).length;const even=ticket.main.length-odd;const parity=1-Math.abs(odd-even)/ticket.main.length;const bands=new Set(ticket.main.map(n=>rangeBand(n,config.min,config.max)));const spread=bands.size/Math.min(3,ticket.main.length);const fav=new Set(mainFavorites);const favoriteShare=ticket.main.filter(n=>fav.has(n)).length/ticket.main.length;const specialFavorite=ticket.special!==null&&new Set(specialFavorites).has(ticket.special)?1:0;return 1+parity*.55+spread*.55+favoriteShare*.2+specialFavorite*.08;}
  function createPersonalCandidate(game,playType,mainFavorites,specialFavorites,random){const config=GAMES[game];const main=buildMain(game,playType,random,mainFavorites);const special=config.special?weightedChoice(Array.from({length:config.special.max-config.special.min+1},(_,i)=>config.special.min+i),specialFavorites,random):null;return {main,special,playLabel:playLabelFor(game,playType,main)};}
  function ticketKey(ticket){return `${ticket.main.join(',')}|${ticket.special===null?'':ticket.special}`;}
  function generatePersonalTicket(game,playType='straight',options={}){const config=GAMES[game];const random=options.random||Math.random;const mainFavorites=normalizeFavorites(options.mainFavorites,config.min,config.max);const specialFavorites=config.special?normalizeFavorites(options.specialFavorites,config.special.min,config.special.max):[];const previous=options.previousTicket?ticketKey(options.previousTicket):null;let candidates=Array.from({length:6},()=>createPersonalCandidate(game,playType,mainFavorites,specialFavorites,random));let weights=candidates.map(t=>diversityScore(t,config,mainFavorites,specialFavorites));for(let attempts=0;attempts<10;attempts++){const total=weights.reduce((a,b)=>a+b,0);let cursor=random()*total;let chosen=candidates.at(-1);for(let i=0;i<candidates.length;i++){cursor-=weights[i];if(cursor<0){chosen=candidates[i];break;}}if(!previous||ticketKey(chosen)!==previous)return chosen;candidates=Array.from({length:6},()=>createPersonalCandidate(game,playType,mainFavorites,specialFavorites,random));weights=candidates.map(t=>diversityScore(t,config,mainFavorites,specialFavorites));}return candidates[0];}

  return { GAMES, PLAY_TYPES, generateRandomTicket, generatePersonalTicket, normalizeFavorites, ticketKey, boxWays };
}));
