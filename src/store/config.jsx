import React, { createContext, useReducer } from "react";

const initData = {
  firstLetter: "",
  middleLetter: "",
  lastLetter: "",
  delimiter: 0,
  productOptions: 0,
  rulesRange: 0,
  productRange: 1,
  collectId: undefined,
};

export const ConfigContext = createContext(initData);

const ConfigController = (state, action) => {
  switch (action.type) {
    case "update":
      return action.value;
    case "clear":
      return {};
    default:
      return state;
  }
};
export const ConfigProvider = (props) => {
  const [state, dispatch] = useReducer(ConfigController, initData);
  return (
    <ConfigContext.Provider value={{ state, dispatch }}>
      {props.children}
    </ConfigContext.Provider>
  );
};
