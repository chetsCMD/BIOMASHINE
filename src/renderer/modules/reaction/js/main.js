import { bm } from 'bm://app/sdk/bm.js';
import { ReactionModule } from './ReactionModule.js';

bm.ready.then(() => new ReactionModule(bm, document).start());
