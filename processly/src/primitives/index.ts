import type { Handler } from '../engine/types.js';
import * as actions from './actions.js';
import * as ai from './ai.js';
import * as data from './data.js';

/** Step primitives implemented as handlers. Control flow lives in the interpreter; triggers in ../triggers. */
export const HANDLERS: Record<string, Handler> = {
  'ai.extract': ai.extract,
  'ai.classify': ai.classify,
  'ai.summarize': ai.summarize,
  'ai.generate': ai.generate,
  'ai.qualify': ai.qualify,
  'ai.translate': ai.translate,
  'ai.sentiment': ai.sentiment,
  'ai.decide': ai.decide,
  'data.validate': data.validate,
  'data.transform': data.transform,
  'data.dedupe': data.dedupe,
  'data.enrich': data.enrich,
  'data.store': data.store,
  'data.query': data.query,
  'send.email': actions.sendEmail,
  'send.whatsapp': actions.sendWhatsApp,
  'crm.create': actions.crmCreate,
  'crm.update': actions.crmUpdate,
  'task.create': actions.taskCreate,
  'calendar.book': actions.calendarBook,
  'doc.generate': actions.docGenerate,
  'notify.team': actions.notifyTeam,
  'integration.call': actions.integrationCall,
};
