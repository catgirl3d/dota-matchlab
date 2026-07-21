import { getItemIcon } from '../../lib/item-icons';
import { useTranslation } from '../../lib/i18n';
import { Tooltip } from '../Tooltip';

export type PermanentUpgradeKind = 'scepter' | 'shard' | 'moonShard';

type PermanentUpgradeSlotProps = {
  kind: PermanentUpgradeKind;
  itemId: number | null;
  slotClassName: string;
  placeholderClassName: string;
  itemIconClassName?: string;
};

export function PermanentUpgradeSlot({
  kind,
  itemId,
  slotClassName,
  placeholderClassName,
  itemIconClassName,
}: PermanentUpgradeSlotProps) {
  const { t } = useTranslation();
  const upgradeLabel = t(
    kind === 'scepter'
      ? 'scoreboardAghanimScepterLabel'
      : kind === 'shard'
        ? 'scoreboardAghanimShardLabel'
        : 'scoreboardMoonShardLabel',
  );
  const item = itemId === null ? null : getItemIcon(itemId);
  const itemLabel = item?.label ?? (itemId === null ? null : `Item #${itemId}`);
  const isEmpty = itemId === null;
  const tooltip = isEmpty
    ? t('scoreboardPermanentUpgradeEmptyTooltip', { upgrade: upgradeLabel })
    : t('scoreboardPermanentUpgradeTooltip', { upgrade: upgradeLabel });
  const ariaLabel = isEmpty
    ? t('scoreboardPermanentUpgradeEmptyAriaLabel', { upgrade: upgradeLabel })
    : t('scoreboardPermanentUpgradeAriaLabel', { upgrade: upgradeLabel, item: itemLabel ?? '' });

  return (
    <Tooltip content={tooltip} ariaLabel={ariaLabel}>
      <span className={`${slotClassName}${isEmpty ? ' is-empty' : ''}`}>
        {item ? <img className={itemIconClassName} src={item.src} alt={item.label} /> : isEmpty ? <span className={placeholderClassName} aria-hidden="true">{kind === 'scepter' ? 'S' : kind === 'shard' ? 'SH' : 'M'}</span> : <strong>#{itemId}</strong>}
      </span>
    </Tooltip>
  );
}
