const fs = require('fs');
const path = 'frontend/frontend/src/components/settings/PharmacySettingsForm.tsx';
let content = fs.readFileSync(path, 'utf8');

// Replace remaining activeTab openings with TabsContent (remove the wrapper div)
content = content.replace(
  /\{activeTab === 'tva' && \(\n\s*<div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">/,
  '<TabsContent value="tva" className="mt-0 data-[state=inactive]:hidden space-y-8">'
);
content = content.replace(
  /\{activeTab === 'notifications' && \(\n\s*<div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">/,
  '<TabsContent value="notifications" className="mt-0 data-[state=inactive]:hidden space-y-8">'
);
content = content.replace(
  /\{activeTab === 'reports' && \(\n\s*<div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">/,
  '<TabsContent value="reports" className="mt-0 data-[state=inactive]:hidden space-y-8">'
);

// Replace closers before each next tab comment or before </form>
// Pattern: </div>\n            )} followed by \n\n            {/* --- TAB: ... */}
// or for the last one: </div>\n            )}\n          </form>

const anchors = [
  '\n\n            {/* --- TAB: STOCKS',
  '\n\n            {/* --- TAB: TVA',
  '\n\n            {/* --- TAB: NOTIFICATIONS',
  '\n\n            {/* --- TAB: RAPPORTS',
  '\n          </form>'
];

for (const anchor of anchors) {
  const escapedAnchor = anchor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp('(              </div>\\n            )\\)}(' + escapedAnchor + ')', 'g');
  content = content.replace(regex, '$1</TabsContent>$2');
}

fs.writeFileSync(path, content);
console.log('Done');
