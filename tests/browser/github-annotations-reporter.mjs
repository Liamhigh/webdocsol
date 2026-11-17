function annotationData(value) {
  return String(value || 'Unknown Playwright failure')
    .replace(/%/g, '%25')
    .replace(/\r/g, '%0D')
    .replace(/\n/g, '%0A');
}

/** Keep detailed synthetic-browser failures visible in public CI annotations. */
export default class GitHubAnnotationsReporter {
  onTestEnd(test, result) {
    if (result.status === 'passed' || result.status === 'skipped') return;
    for (const error of result.errors) {
      const location = test.location ? `${test.location.file}:${test.location.line}` : test.title;
      console.log(`::error title=Playwright ${test.title}::${annotationData(location)}%0A${annotationData(error.message)}`);
    }
  }
}
