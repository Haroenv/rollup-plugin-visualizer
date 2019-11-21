import { pointer } from "d3-selection";
import { format as formatBytes } from "bytes";

const getNodePathTree = d =>
  d
    .ancestors()
    .reverse()
    .map(d => d.data.name)
    .join("/");

const getNodeSizeTree = d => d.value;

const getNodeUidTree = d => d.data.uid;

const SIZE_LABELS = {
  originalLength: "OL",
  renderedLength: "RL",
  gzipLength: "GL",
  sourcemapLength: "SL"
};

export class Tooltip {
  constructor(container) {
    this.tooltip = container
      .append("div")
      .style("opacity", 0)
      .attr("class", "tooltip");

    this.container = container;

    this.onMouseLeave = this.onMouseLeave.bind(this);
    this.onMouseOver = this.onMouseOver.bind(this);
    this.onMouseMove = this.onMouseMove.bind(this);
  }

  onMouseOver() {
    this.tooltip.style("opacity", 1);
  }

  onMouseMove(event, data) {
    const { html } = this.tooltipContentCache.get(data);

    this.tooltip.html(html);

    const [x, y] = pointer(event, this.container.node());

    const tooltipBox = this.tooltip.node().getBoundingClientRect();
    const containerBox = this.container.node().getBoundingClientRect();

    const availableWidthRight = containerBox.width - x;
    const availableHeightBottom = containerBox.height - y;

    const positionStyles = [];
    const offsetX = 10;
    const offsetY = 10;
    if (availableHeightBottom >= tooltipBox.height + offsetY) {
      positionStyles.push(["top", y + offsetY], ["bottom", null]);
    } else {
      positionStyles.push(
        ["top", null],
        ["bottom", availableHeightBottom + offsetY]
      );
    }
    if (availableWidthRight >= tooltipBox.width + offsetX) {
      positionStyles.push(["left", x + offsetX], ["right", null]);
    } else {
      positionStyles.push(
        ["left", null],
        ["right", availableWidthRight + offsetX]
      );
    }

    for (const [pos, offset] of positionStyles) {
      this.tooltip.style(
        pos,
        typeof offset === "number" ? offset + "px" : offset
      );
    }
  }

  onMouseLeave() {
    this.tooltip.style("opacity", 0);
  }

  buildCache(
    contentNodes,
    {
      totalSize,
      getNodeSize = getNodeSizeTree,
      getNodePath = getNodePathTree,
      getNodeUid = getNodeUidTree,
      nodes,
      links,
      sizes
    }
  ) {
    this.tooltipContentCache = new Map();

    const importedByCache = new Map();
    const importedCache = new Map();

    for (const { source, target } of links) {
      if (!importedByCache.has(target)) {
        importedByCache.set(target, []);
      }
      if (!importedCache.has(source)) {
        importedCache.set(source, []);
      }

      importedByCache.get(target).push({ uid: source, ...nodes[source] });
      importedCache.get(source).push({ uid: target, ...nodes[target] });
    }

    contentNodes.each(data => {
      const contentCache = {};

      const str = [];
      if (getNodePath != null) {
        str.push(getNodePath(data));
      }

      const values = getNodeSize(data);
      const [defaultSize, ...otherSizes] = sizes;
      if (values[defaultSize] !== 0) {
        let sizeStr = `<b>${SIZE_LABELS[defaultSize]}: ${formatBytes(
          values[defaultSize]
        )}</b>`;

        if (totalSize != null) {
          const percentageNum = (100 * values[defaultSize]) / totalSize;
          const percentage = percentageNum.toFixed(2);
          const percentageString = percentage + "%";

          sizeStr += ` (${percentageString})`;
        }
        str.push(sizeStr);
      }
      for (const size of otherSizes) {
        str.push(`${SIZE_LABELS[size]}: ${formatBytes(values[size])}`);
      }

      const uid = getNodeUid(data);
      if (uid && importedByCache.has(uid)) {
        const importedBy = importedByCache.get(uid);
        str.push(
          `<b>Imported By</b>: <br/>${[
            ...new Set(importedBy.map(({ id }) => id))
          ].join("<br/>")}`
        );
      }

      contentCache.html = str.join("<br/>");

      this.tooltipContentCache.set(data, contentCache);
    });
  }
}
