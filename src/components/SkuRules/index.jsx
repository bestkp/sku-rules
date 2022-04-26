import React, {
  useContext,
  useEffect,
  useState,
  forwardRef,
  useImperativeHandle,
} from "react";
import {
  Button,
  Form,
  Input,
  Space,
  InputNumber,
  Row,
  Col,
  Radio,
  message,
  Select,
  Modal,
  Spin,
} from "antd";
import { ConfigContext } from "../../store/config";
import { useAppBridge } from "@shopify/app-bridge-react";
import { getSessionToken } from "@shopify/app-bridge-utils";
// import { ResourcePicker } from "@shopify/app-bridge-react";
import styles from "./index.module.css";

const { Option } = Select;
const { confirm } = Modal;
const initialForm = {
  firstLetter: "",
  middleLetter: "",
  lastLetter: "",
  delimiter: 0,
  productOptions: 0,
  rulesRange: 0,
  productRange: 0,
  collectId: undefined,
};

const SkuRules = ({ onConfig, count, updateSku }, ref) => {
  const [form] = Form.useForm();
  const app = useAppBridge();
  const { state, dispatch } = useContext(ConfigContext);
  const [saving, setSaving] = useState(false);
  const [openObj, setOpenObj] = useState({ open: false, type: "Product" });
  const [lastGen, setLastGen] = useState(0);
  const [collectionItems, setCollectionItems] = useState([]);
  const [productsCount, setProductsCount] = useState(count);

  useImperativeHandle(ref, () => ({
    getConfig,
  }));

  useEffect(() => {
    setProductsCount(count);
  }, [count]);

  const onSave = async (values) => {
    const token = await getSessionToken(app);
    setSaving(true);
    try {
      const response = await fetch("/app/save", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          firstLetter: values.firstLetter,
          middleLetter: values.middleLetter,
          lastLetter: values.lastLetter,
          delimiter: values.delimiter,
          collectId: values.collectId,
          rulesRange: values.rulesRange,
          productRange: values.productRange,
          productOptions: values.productOptions,
          ids: [1, 2, 3],
        }),
      });
      const data = await response.json();
      if(data.status == 200) {
        message.success("已设置");
        updateSku(() => {
          setSaving(false);
        });
      }
    } catch (e) {
      setSaving(false);
      message.error(e);
    }
  };
  const onFinish = async (values) => {
    console.log("Received values of form: ", values);
    confirm({
      title: "请确认",
      icon: "",
      content:
        "SKU生成过程将替换目标产品的所有SKU，没有撤销，请确认要执行该操作吗？",
      okText: "确认",
      cancelText: "取消",
      onOk() {
        onSave(values);
      },
      onCancel() {
        console.log("Cancel");
      },
    });
  };
  const getConfig = async () => {
    const token = await getSessionToken(app);
    setSaving(true);
    try {
      const response = await fetch("/app/getConfig", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: null,
      });
      const {
        data: { config, collections },
      } = await response.json();
      const colletionItems = collections.edges.map((edge) => {
        return { ...edge.node };
      });
      setCollectionItems(colletionItems);
      let obj = {};
      if (JSON.stringify(config) !== "{}") {
        // setFormValues(config);
        obj = {
          firstLetter: config.firstLetter,
          middleLetter: config.middleLetter,
          lastLetter: config.lastLetter,
          delimiter: config.delimiter,
          productOptions: config.productOptions,
          rulesRange: config.rulesRange,
          productRange: config.productRange,
          collectId: config.collectId,
        };
        setLastGen(config.lastGen);
        form.setFieldsValue(obj);
      } else {
        obj = { ...initialForm, collectId: colletionItems[0].id };
        form.setFieldsValue(obj);
      }
      dispatch({ type: "update", value: obj });
      setSaving(false);
    } catch (e) {
      setSaving(false);
      message.error(e);
    }
  };
  // const handleSelection = (resources) => {
  //   console.log("selected", resources.selection);
  //   const ids = resources.selection.map((ser) => ser.id);
  //   console.log("selected", resources, ids);
  //   setOpenObj({ ...openObj, open: false });
  // };
  const handleSelectAction = (type) => {
    form.setFieldsValue({
      rulesRange: type === "Product" ? 2 : 1,
    });
    setOpenObj({
      type,
      open: true,
    });
  };
  const handleSelectChange = (val) => {
    console.log(val);
    form.setFieldsValue({ rulesRange: 1 });
  };
  const handleInput = (val) => {
    console.log(val);
  };
  useEffect(() => {
    getConfig();
  }, []);
  return (
    <div className={styles.rules}>
      {/*<ResourcePicker // Resource picker component*/}
      {/*  resourceType={openObj.type}*/}
      {/*  key={openObj.type}*/}
      {/*  showVariants={false}*/}
      {/*  open={openObj.open}*/}
      {/*  onSelection={(resources) => handleSelection(resources)}*/}
      {/*  onCancel={() => setOpenObj({ ...openObj, open: false })}*/}
      {/*/>*/}
      <Spin spinning={saving}>
        <h3>产品SKU基础规则</h3>
        <Form
          autoComplete="off"
          form={form}
          name="register"
          onFinish={onFinish}
          initialValues={initialForm}
          size="large"
          layout="vertical"
          scrollToFirstError
          onValuesChange={(value, allValues) => {
            console.log(allValues);
            // onConfig(allValues);
            dispatch({ type: "update", value: allValues });
          }}
        >
          <Row gutter={20}>
            <Col span={6}>
              <Form.Item name="firstLetter" label="SKU首字母：">
                <Input maxLength={7} placeholder="SKU首字母" />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="middleLetter" label="SKU中间数字：">
                <InputNumber
                  className={styles.inputNumber}
                  min={0}
                  maxLength={9}
                  onInput={handleInput}
                  placeholder="SKU中间数字"
                />
              </Form.Item>
            </Col>
            <Col span={6}>
              <Form.Item name="lastLetter" label="SKU尾字母：">
                <Input maxLength={7} placeholder="SKU尾字母" />
              </Form.Item>
            </Col>
          </Row>
          <Form.Item name="delimiter" label="首字母、中间数字、尾字母分隔符：">
            <Radio.Group>
              <Radio value={0}>不使用</Radio>
              <Radio value={1}>使用 - 分隔</Radio>
              <Radio value={2}>使用 _ 分隔</Radio>
              <Radio value={3}>使用 | 分隔</Radio>
              <Radio value={4}>使用 . 分隔</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="productOptions" label="产品选项值：">
            <Radio.Group>
              <Radio value={0}>不使用</Radio>
              <Radio value={1}>使用（产品选项值会在SKU首字母后）</Radio>
            </Radio.Group>
          </Form.Item>
          <Form.Item name="rulesRange" label="规则适用范围：">
            <Radio.Group>
              <Space direction="vertical">
                <Radio value={0}>全部产品</Radio>

                <Space>
                  <Radio value={1}>特定产品系列 </Radio>
                  <Form.Item name="collectId" style={{ marginBottom: 0 }}>
                    <Select
                      style={{ width: 200 }}
                      size="middle"
                      className={styles.selectBtn}
                      placeholder="请选择系列"
                      onChange={handleSelectChange}
                    >
                      {collectionItems.map((item) => {
                        return (
                          <Option value={item.id} key={item.id}>
                            {item.title}
                          </Option>
                        );
                      })}
                    </Select>
                  </Form.Item>
                </Space>
                {/*<Radio value={2}>*/}
                {/*  特定产品{" "}*/}
                {/*  <Button*/}
                {/*    type="primary"*/}
                {/*    style={{ marginLeft: 68 }}*/}
                {/*    className={styles.selectBtn}*/}
                {/*    size="middle"*/}
                {/*    onClick={() => handleSelectAction("Product")}*/}
                {/*  >*/}
                {/*    浏览*/}
                {/*  </Button>*/}
                {/*</Radio>*/}
              </Space>
            </Radio.Group>
          </Form.Item>

          <Form.Item name="productRange" label="产品适用范围：">
            <Radio.Group>
              <Radio value={0}>适用选中范围内产品SKU为空</Radio>
              <Radio value={1}>适用选中范围内全部产品SKU</Radio>
            </Radio.Group>
          </Form.Item>
          <Row justify="space-between">
            <Col span={12}>
              {lastGen
                ? `上次运行生成${lastGen}个SKU`
                : `${productsCount}个产品SKU将会被更新`}
            </Col>
            <Col span={4}>
              <Button
                disabled={saving}
                loading={saving}
                onClick={() => form.submit()}
                type="primary"
              >
                保存
              </Button>
            </Col>
          </Row>
        </Form>
      </Spin>
    </div>
  );
};

export default forwardRef(SkuRules);
