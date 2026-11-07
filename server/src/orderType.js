export function customItems(order) {
  return (order.items || []).filter((item) => item.designId || (item.config && Object.keys(item.config).length) || (item.slug && Object.hasOwn(order.designs || {}, item.slug)));
}

export function orderType(order) {
  const count = customItems(order).length;
  if (count) return count === order.items.length ? 'custom' : 'mixed';
  return Object.keys(order.designs || {}).length ? 'custom' : 'shop';
}
