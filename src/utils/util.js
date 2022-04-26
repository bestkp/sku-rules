import React from "react";

export const getParamString = (params) => {
  if (!params || JSON.stringify(params) === "{}") return "";
  return (
    "?" +
    Object.keys(params)
      .map((k) => encodeURIComponent(k) + "=" + encodeURIComponent(params[k]))
      .join("&")
  );
};

export const genNewSku = (row, config, index) => {
  const delimiterArr = ["", "-", "_", "|", "."];
  if (config && JSON.stringify(config) !== "{}") {
    const {
      firstLetter,
      middleLetter,
      lastLetter,
      delimiter,
      productOptions,
      rulesRange,
      productRange,
    } = config;
    if (
      (!config.productRange && !row.variantObj.sku) ||
      config.productRange === 1
    ) {
      const optionsStr = productOptions
        ? row.variantObj.title.split(" / ").join("")
        : "";
      const delimitStr = delimiterArr[delimiter];
      return `${
        firstLetter ? firstLetter.trimLeft() + delimitStr : ""
      }${optionsStr}${middleLetter ? +middleLetter + index: ""}${
        lastLetter ? delimitStr + lastLetter.trimRight() : ""
      }`;
    } else {
      return "- exsits -";
    }
  }
  return "";
};
const genVariantItems = (productEdge, variantEdges) => {
  const variantsArr = [...variantEdges];
  return variantsArr.map((variant) => {
    const { images } = productEdge;
    const { id } = variant;
    let imgItem =
      images && images.filter((image) => image.variant_ids.includes(id));
    let imgUrl = imgItem && imgItem.length && imgItem[0].src;
    return { ...productEdge, variantObj: { ...variant, src: imgUrl } };
  });
};
export const getVariantsByProducts = (edges) => {
  let finalData = [];
  edges.forEach((edge) => {
    const { variants } = edge;
    if (variants.length) {
      let variantsItems = genVariantItems(edge, variants);
      finalData = [...finalData, ...variantsItems];
    }
  });
  return finalData;
};
