export type DecisionFailurePresentation = "command" | "plain";

export type DecisionApplicationFailure = {
  errors: string[];
  exitCode: 1 | 2;
  presentation: DecisionFailurePresentation;
  status: "error";
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
