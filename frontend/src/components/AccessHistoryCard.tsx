import { formatPriceEth } from "../lib/format";

export interface AccessRecord {
  buyer: string;
  isRental: boolean;
  amountPaid: bigint;
  expiresAt: number; // unix timestamp, 0 = permanent
}

interface AccessHistoryCardProps {
  records: AccessRecord[];
  totalCount: number;
}

function truncateAddress(addr: string): string {
  if (addr.length < 10) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function formatExpiry(expiresAt: number): string {
  if (expiresAt === 0) return "Permanent";
  const now = Math.floor(Date.now() / 1000);
  if (expiresAt < now) return "Expired";
  const days = Math.ceil((expiresAt - now) / 86400);
  return `Expires in ${days}d`;
}

export function AccessHistoryCard({ records, totalCount }: AccessHistoryCardProps): JSX.Element {
  if (totalCount === 0) {
    return (
      <section className="hero-card access-history-card">
        <p className="eyebrow">Access History</p>
        <h2>No Transactions Yet</h2>
        <p className="intro">This agent has not been accessed by any buyer yet. Be the first.</p>
      </section>
    );
  }

  return (
    <section className="hero-card access-history-card">
      <p className="eyebrow">Access History</p>
      <h2>
        {totalCount} Transaction{totalCount !== 1 ? "s" : ""}
      </h2>
      <p className="intro">
        On-chain record of all rental and purchase transactions for this agent.
      </p>
      <div className="access-history__table-wrapper">
        <table className="access-history__table">
          <thead>
            <tr>
              <th>Buyer</th>
              <th>Type</th>
              <th>Amount</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record, i) => (
              <tr key={i} className="access-history__row">
                <td className="access-history__address">{truncateAddress(record.buyer)}</td>
                <td>
                  <span className={`access-type-badge access-type-badge--${record.isRental ? "rental" : "purchase"}`}>
                    {record.isRental ? "Rental" : "Purchase"}
                  </span>
                </td>
                <td className="access-history__amount">{formatPriceEth(record.amountPaid)}</td>
                <td>
                  <span className={`access-expiry ${record.expiresAt === 0 ? "access-expiry--permanent" : record.expiresAt < Math.floor(Date.now() / 1000) ? "access-expiry--expired" : "access-expiry--active"}`}>
                    {formatExpiry(record.expiresAt)}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {totalCount > records.length ? (
        <p className="access-history__more">
          Showing {records.length} of {totalCount} transactions
        </p>
      ) : null}
    </section>
  );
}
