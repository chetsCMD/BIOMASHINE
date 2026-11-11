import { bm } from 'bm://app/sdk/bm.js';
import { CigaretteApp } from './CigaretteApp.js';

bm.ready.then(() => new CigaretteApp(bm, document, window.Chart).start());
