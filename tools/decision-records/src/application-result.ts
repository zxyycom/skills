export type DecisionFailurePresentation = "command" | "plain";

export type DecisionApplicationFailure = {
  errors: string[];
  exitCode: 1 | 2;
  presentation: DecisionFailurePresentation;
  status: "error";
};

export type DecisionApplicationAttention = {
  exitCode: 1;
  status: "attention";
  warnings: string[];
};

export function decisionFailure(
  errors: string[],
  options: {
    exitCode?: 1 | 2;
    presentation?: DecisionFailurePresentation;
  } = {}
): DecisionApplicationFailure {
  return {
    errors,
    exitCode: options.exitCode ?? 1,
    presentation: options.presentation ?? "command",
    status: "error"
  };
}

export function decisionAttention(
  warnings: string[]
): DecisionApplicationAttention {
  return {
    exitCode: 1,
    status: "attention",
    warnings
  };
}
