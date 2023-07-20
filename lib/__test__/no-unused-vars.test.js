const rule = require("../rules/no-unused-vars");
RuleTester = require("eslint").RuleTester;

const ruleTester = new RuleTester({
  parserOptions: { ecmaVersion: 2015, sourceType: "module" },
});

ruleTester.run("no-unused-vars", rule, {
  valid: [
    {
      code: `
import x from "package";
import { a, b } from "./utils";
import y from "package";

const c = a() + b + x() + y();
consoloe.log(c)
`,
    },
  ],
  invalid: [
    {
      code: `
			import classNames from 'classnames/bind';

			import styles from './index.module.less';
			
			const cx = classNames.bind(styles);
`,
      errors: ["'cx' is assigned a value but never used."],
      output: `
			import classNames from 'classnames/bind';

			import styles from './index.module.less';
`,
    },
  ],
});
