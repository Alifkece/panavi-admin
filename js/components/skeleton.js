// ===== SKELETON LOADING HELPERS =====

export function skeletonStatCards(count = 4) {
  return Array.from({ length: count })
    .map(
      () => `
      <div class="stat-card stat-card-skel">
        <div class="skel-block" style="width:36px;height:36px;margin-bottom:14px;"></div>
        <div class="skel-block skel-line" style="width:60%;height:22px;"></div>
        <div class="skel-block skel-line" style="width:40%;"></div>
      </div>`
    )
    .join("");
}

export function skeletonTableRows(cols = 4, rows = 5) {
  return Array.from({ length: rows })
    .map(
      () => `
      <tr>
        ${Array.from({ length: cols })
          .map(() => `<td><div class="skel-block skel-line" style="width:${60 + Math.random() * 30}%;"></div></td>`)
          .join("")}
      </tr>`
    )
    .join("");
}

export function skeletonList(rows = 4) {
  return Array.from({ length: rows })
    .map(
      () => `
      <div class="mini-list-item">
        <div class="skel-block" style="width:34px;height:34px;border-radius:10px;"></div>
        <div style="flex:1;">
          <div class="skel-block skel-line" style="width:70%;"></div>
          <div class="skel-block skel-line" style="width:40%;"></div>
        </div>
      </div>`
    )
    .join("");
}
