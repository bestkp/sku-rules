import React, { useContext, useEffect, useRef, useState } from "react";
import SkuRules from "./SkuRules";
import SkuPreview from "./SkuPreview";
import { message, Button, Modal, Progress } from "antd";
import { getVariantsByProducts } from "../utils/util";
import { ConfigContext } from "../store/config";
import { getSessionToken } from "@shopify/app-bridge-utils";
import { useAppBridge } from "@shopify/app-bridge-react";

const Index = () => {
  const app = useAppBridge();
  const [tableData, setTableData] = useState({
    loading: false,
    data: [],
  });
  const { state: config, dispatch } = useContext(ConfigContext);
  const ruleRef = useRef(null);
  const timer = useRef(null);
  const [count, setCount] = useState(0);
  const [modal, setModal] = useState({
    visible: false,
    percent: 0,
    total_variants: 0,
  });

  // const handleConfigChange = (config) => {
  //   setConfig(config);
  // };
  const getProductVariants = async () => {
    const token = await getSessionToken(app);
    setTableData({ ...tableData, loading: true });
    const url =
      config && config.rulesRange == 1
        ? `/app/getProducts?id=${config.collectId}`
        : `/app/getProducts`;
    try {
      const response = await fetch(url, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: null,
      });
      const data = await response.json();
      let finalData = [];
      const { products, count } = data.data;
      finalData = getVariantsByProducts(products);
      setCount(count.count);
      setTableData({ data: finalData, loading: false });
    } catch (e) {
      message.error(e);
    }
  };
  //更新sku
  const updateSku = async (cb) => {
    const token = await getSessionToken(app);
    try {
      const response = await fetch("/app/updateSku", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(config),
      });
      const skuRes = await response.json();
      if (skuRes.status === 200) {
        startQueryUpdateStatus();
      }
      cb && cb();
    } catch (err) {
      cb && cb();
      message.error(err);
    }
  };
  // 查询更新进度
  const startQueryUpdateStatus = () => {
    setModal({
      ...modal,
      percent: 0,
      visible: true,
    });
    timer.current = setInterval(async () => {
      try {
        const token = await getSessionToken(app);
        const response = await fetch("/app/updateStatus", {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });
        const updateStatus = await response.json();
        if (updateStatus.data && JSON.stringify(updateStatus.data) === "{}") {
          return;
        }
        const {
          data: {
            is_generating,
            products_updated,
            total_products,
            total_variants,
          },
        } = updateStatus;
        console.log(
          "updateStatus",
          updateStatus,
          parseInt((products_updated / total_products) * 100) + "%"
        );
        setModal({
          ...modal,
          percent: parseInt((products_updated / total_products) * 100),
          total_variants: total_variants,
          visible: true,
        });
        if (!is_generating) {
          clearInterval(timer.current);
          getProductVariants();
          ruleRef.current.getConfig();
          await fetch("/app/reset/variable", {
            method: "GET",
            headers: {
              Authorization: `Bearer ${token}`,
            },
          });
        }
      } catch (err) {
        message.error(err);
      }
    }, 2000);
  };
  useEffect(() => {
    getProductVariants();
  }, [config.rulesRange, config.collectId]);
  return (
    <div style={{ padding: 40 }}>
      <SkuRules
        // onConfig={handleConfigChange}
        count={count}
        updateSku={updateSku}
        ref={ruleRef}
      ></SkuRules>
      <SkuPreview tableData={tableData} config={config}></SkuPreview>
      <Modal
        title={"产品SKU生成"}
        maskClosable={false}
        visible={modal.visible}
        closable={modal.percent >= 100}
        footer={null}
        onCancel={() => {
          setModal({ ...modal, visible: false });
        }}
      >
        <div style={{ margin: "30px 0 40px" }}>
          <p>{`${count}个产品的SKU正在按照规则生成，请耐心等待！为确保SKU生成的完整性，请勿关闭页面`}</p>
          <Progress
            strokeLinecap="square"
            strokeWidth={20}
            percent={modal.percent}
          />
        </div>
      </Modal>
    </div>
  );
};

export default Index;
