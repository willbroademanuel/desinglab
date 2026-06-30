import { dashboard } from './dashboard';
import { tools } from './tools';
import { modals } from './modals';

export default {
  ...dashboard,
  ...tools,
  ...modals
} as const;
