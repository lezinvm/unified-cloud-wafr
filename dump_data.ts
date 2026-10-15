import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { PILLARS_DATA } from './src/data/wafrData';
import { INITIAL_COMPLIANCE_FRAMEWORKS } from './src/data/complianceData';
import { INITIAL_INTEGRATIONS, INITIAL_ALERT_LOGS } from './src/data/integrationData';
import { INITIAL_ORG_QUESTIONS } from './src/data/questionnaireData';

const dump = {
  pillars: PILLARS_DATA,
  complianceFrameworks: INITIAL_COMPLIANCE_FRAMEWORKS,
  integrations: INITIAL_INTEGRATIONS,
  alertLogs: INITIAL_ALERT_LOGS,
  orgQuestions: INITIAL_ORG_QUESTIONS,
};

const outPath = path.resolve('backend', 'platform_data_dump.json');
fs.writeFileSync(outPath, JSON.stringify(dump, null, 2), 'utf-8');
console.log(`[OK] Platform datasets dumped successfully to ${outPath}`);
