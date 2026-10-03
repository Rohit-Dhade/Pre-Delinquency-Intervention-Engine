/**
 * CustomerLookupPage — legacy route alias.
 * Delegates to the Dashboard lookup to keep one consistent UI.
 */
import DashboardPage from './DashboardPage';

export default function CustomerLookupPage() {
  return <DashboardPage />;
}
