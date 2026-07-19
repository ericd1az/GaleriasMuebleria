import { Fragment } from 'react';
import { ChevronRight } from 'lucide-react';

export default function Breadcrumbs({ currentView, setView, selectedProduct }) {
  const crumbs = currentView === 'product-detail' && selectedProduct
    ? [
        { label: 'Catálogo', view: 'catalog' },
        { label: selectedProduct.name, view: 'product-detail', active: true },
      ]
    : [];

  if (crumbs.length === 0) return null;

  return (
    <nav className="max-w-7xl mx-auto px-6 py-5 flex items-center space-x-2 text-xs text-[#888888] font-light">
      {crumbs.map((crumb, idx) => {
        const isLast = idx === crumbs.length - 1;
        return (
          <Fragment key={crumb.label}>
            {idx > 0 && <ChevronRight className="w-4 h-4 text-[#C8C8C8]" />}
            {isLast ? (
              <span className="text-[#0A0A0A] font-light truncate max-w-[150px] sm:max-w-xs">
                {crumb.label}
              </span>
            ) : (
              <button
                onClick={() => setView(crumb.view)}
                className="hover:text-[#0A0A0A] transition-colors focus:outline-none"
              >
                {crumb.label}
              </button>
            )}
          </Fragment>
        );
      })}
    </nav>
  );
}
