export type ReportValidationError = (message: string) => void;

export class ValidationReporter {
  readonly errors: string[] = [];

  report: ReportValidationError = (message) => {
    this.errors.push(message);
  };

  addAll(messages: Iterable<string>): void {
    for (const message of messages) {
      this.report(message);
    }
  }

  hasErrors(): boolean {
    return this.errors.length > 0;
  }
}
