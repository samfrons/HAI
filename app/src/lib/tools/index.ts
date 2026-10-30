import { crisisUpdatesTool } from './crisis-updates';
import { hazardsContextTool } from './hazards-context';
import { humanitarianDataTool } from './humanitarian-data';
import { searchStandardsTool } from './search-standards';

/**
 * The tool set exposed to the model. Keys are the names the model calls and
 * the names the UI matches on for its `tool-<name>` message parts, so changing
 * one means changing `TOOL_LABELS` in the UI too.
 */
export const haiTools = {
  search_standards: searchStandardsTool,
  crisis_updates: crisisUpdatesTool,
  humanitarian_data: humanitarianDataTool,
  hazards_context: hazardsContextTool,
};

export type HaiTools = typeof haiTools;
