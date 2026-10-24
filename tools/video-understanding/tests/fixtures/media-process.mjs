if (process.argv[2] === "wait") {
  setInterval(() => {}, 1000);
} else if (process.argv[2] === "fail") {
  console.error("fixture diagnostic");
  process.exitCode = 2;
} else if (process.argv[2] === "secrets") {
  process.stderr.write(
    'password=first-value token=second-value\n{"api_key": "json-value"}\nTo'
  );
  setTimeout(() => {
    const keyType = "PRIVATE KEY";
    process.stderr.write(
      `ken=chunk-value\n-----BEGIN ${keyType}-----\nkey-value\n-----END ${keyType}-----\nsafe diagnostic\n`
    );
    console.log(JSON.stringify({ value: 1 }));
  }, 20);
} else if (process.argv[2] === "stdout-overflow") {
  process.stdout.write("汉".repeat(3 * 1024 * 1024));
} else if (process.argv[2] === "stderr-overflow") {
  process.stderr.write("汉".repeat(24 * 1024));
  console.log(JSON.stringify({ value: 1 }));
} else {
  console.log(JSON.stringify({ value: 1 }));
}
