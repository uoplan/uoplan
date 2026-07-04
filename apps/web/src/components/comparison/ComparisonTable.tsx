import { Box } from "@mantine/core";
import { Fragment } from "react";
import { tr } from "../../i18n";
import { CATEGORIES, FEATURES, PRODUCTS } from "../../lib/comparison";
import type { Feature, Product } from "../../lib/comparison";
import { SupportCell } from "./SupportCell";
import styles from "./comparison.module.css";

interface ComparisonTableProps {
  /** Products to show as columns. Defaults to every product. */
  products?: readonly Product[];
  /**
   * Only include features where at least one shown product supports it (level
   * !== "no"). Used by the focused `/vs` table so it isn't padded with rows
   * neither product offers.
   */
  onlyRelevant?: boolean;
  /** Render a narrower table (used for 2-column `/vs` comparisons). */
  compact?: boolean;
}

function isFeatureRelevant(feature: Feature, products: readonly Product[]): boolean {
  return products.some((product) => feature.support[product.id].level !== "no");
}

/**
 * The master comparison matrix: categories × features × products. Shared by
 * `/compare` (all products) and `/vs/<slug>` (uoPlan + one competitor). Sticky
 * header row + sticky feature column keep both axes readable while scrolling.
 */
export function ComparisonTable({
  products = PRODUCTS,
  onlyRelevant = false,
  compact = false,
}: ComparisonTableProps) {
  const groups = CATEGORIES.map((category) => ({
    category,
    features: FEATURES.filter(
      (feature) =>
        feature.categoryId === category.id &&
        (!onlyRelevant || isFeatureRelevant(feature, products)),
    ),
  })).filter((group) => group.features.length > 0);

  const columnCount = products.length + 1;

  return (
    <Box className={styles.tableScroll}>
      <table className={compact ? `${styles.table} ${styles.compact}` : styles.table}>
        <thead>
          <tr className={styles.headRow}>
            <th className={styles.featureHead} scope="col">
              <span className={styles.categoryLabel}>{tr("compare.table.featureColumn")}</span>
            </th>
            {products.map((product) => (
              <th
                key={product.id}
                scope="col"
                className={product.isUoplan ? styles.uoplanHead : undefined}
              >
                <span className={styles.productHead}>
                  <span className={styles.productName}>{product.name}</span>
                  <span className={styles.productHost}>{product.host}</span>
                </span>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => (
            <Fragment key={group.category.id}>
              <tr className={styles.categoryRow}>
                <td colSpan={columnCount}>
                  <span className={styles.categoryLabel}>{tr(group.category.labelId)}</span>
                </td>
              </tr>
              {group.features.map((feature) => (
                <tr key={feature.id} className={styles.bodyRow}>
                  <th scope="row" className={styles.featureCol}>
                    <span className={styles.featureName}>{tr(feature.nameId)}</span>
                  </th>
                  {products.map((product) => (
                    <td
                      key={product.id}
                      className={product.isUoplan ? styles.uoplanCol : undefined}
                    >
                      <SupportCell support={feature.support[product.id]} />
                    </td>
                  ))}
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </Box>
  );
}
