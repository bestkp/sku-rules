import React, { useMemo } from "react";
import { Table } from "antd";

import styles from "./index.module.css";
import {genNewSku} from "../../utils/util";

const productImg =
  "https://cdn1.funpinpin.com/admin/static/noImg.67c4e9f3769a40c678fe2edf26a1d3b3.svg";



const SkuPreview = ({ tableData, config }) => {
  const { loading, data } = tableData;

  const columns = useMemo(
    () => [
      {
        title: "产品图片",
        dataIndex: "image",
        align: "center",
        width: 100,
        render(text, row) {
          let imgSrc = productImg;
          // 优先展示变体图片，然后产品图， 然后默认图
          if (row.variantObj.src) {
            imgSrc = row.variantObj.src;
          } else if (row.image) {
            imgSrc = row.image.src;
          }
          return (
            <img
              style={{ width: 40, height: 40, objectFit: "contain", border: '1px solid #dedede' }}
              src={imgSrc}
              alt=""
            />
          );
        },
      },
      {
        title: "产品名称",
        dataIndex: "name",
        align: "center",
        width: 500,
        render(text, row) {
          return (
            <div style={{ wordBreak: "break-all" }}>
              {row.title + " | " + row.variantObj.title}
            </div>
          );
        },
      },
      {
        title: "SKU",
        dataIndex: "sku",
        align: "center",
        width: 200,
        render(text, row) {
          return (
            <div style={{ wordBreak: "break-all" }}>{row.variantObj.sku}</div>
          );
        },
      },
      {
        title: "新SKU",
        dataIndex: "newSku",
        align: "center",
        width: 200,
        render(text, row, index) {
          return (
            <div
              style={{ wordBreak: "break-all" }}
            >{genNewSku(row, config, index)}</div>
          );
        },
      },
    ],
    [config]
  );
  return (
    <div className={styles.skuPreview}>
      <h3>产品SKU预览</h3>
      <div className="sku-preview-table">
        <Table
          rowKey={(row) => row.variantObj.id}
          loading={loading}
          dataSource={data}
          columns={columns}
          pagination={false}
        ></Table>
      </div>
    </div>
  );
};

export default SkuPreview;
