import { Component, type ErrorInfo, type ReactNode } from "react";
import { Box, Button, Stack, Text, Title } from "@mantine/core";
import { tr, useTr } from "../../i18n";
import { AppCard } from "./AppCard";

const ERROR_BOUNDARY_TITLE_ID = "errorBoundary.title";
const ERROR_BOUNDARY_MESSAGE_ID = "errorBoundary.message";
const ERROR_BOUNDARY_RELOAD_ID = "errorBoundary.reload";

interface ErrorBoundaryProps {
  children: ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
}

function ErrorBoundaryFallback() {
  useTr();

  return (
    <Box
      component="main"
      style={{
        minHeight: "100vh",
        padding: "60px 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "var(--app-bg)",
      }}
    >
      <AppCard p={32} style={{ maxWidth: 520, width: "100%" }}>
        <Stack gap="md" align="flex-start">
          <Title order={1} size="h2">
            {tr(ERROR_BOUNDARY_TITLE_ID)}
          </Title>
          <Text c="dimmed">{tr(ERROR_BOUNDARY_MESSAGE_ID)}</Text>
          <Button color="accentBlue" onClick={() => window.location.reload()}>
            {tr(ERROR_BOUNDARY_RELOAD_ID)}
          </Button>
        </Stack>
      </AppCard>
    </Box>
  );
}

export class ErrorBoundary extends Component<ErrorBoundaryProps, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught React error:", error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ErrorBoundaryFallback />;
    }

    return this.props.children;
  }
}
