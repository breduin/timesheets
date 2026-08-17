import { render } from "solid-js/web";
import { Router, Route } from "@solidjs/router";
import App from "./App";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Activate from "./pages/Activate";
import Invite from "./pages/Invite";
import Home from "./pages/Home";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import TimePage from "./pages/TimePage";
import Week from "./pages/Week";
import Reports from "./pages/Reports";
import "./index.css";

render(
  () => (
    <Router>
      <Route path="/login" component={Login} />
      <Route path="/register" component={Register} />
      <Route path="/activate/:uid/:token" component={Activate} />
      <Route path="/invite/:token" component={Invite} />
      <Route path="/" component={App}>
        <Route path="/" component={Home} />
        <Route path="/projects" component={Projects} />
        <Route path="/projects/:id" component={ProjectDetail} />
        <Route path="/time" component={TimePage} />
        <Route path="/time/week" component={Week} />
        <Route path="/reports" component={Reports} />
      </Route>
    </Router>
  ),
  document.getElementById("root")!,
);
