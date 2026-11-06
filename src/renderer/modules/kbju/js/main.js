import { bm } from 'bm://app/sdk/bm.js';
import { KbjuModule } from './KbjuModule.js';

bm.ready.then(() => new KbjuModule(bm, document).start());
