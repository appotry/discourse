import DiscourseRoute from "discourse/routes/discourse";
import { i18n } from "discourse-i18n";

export default class AdminConfigTrustLevelsRoute extends DiscourseRoute {
  titleToken() {
    return i18n("admin.community.sidebar_link.trust_levels");
  }
}
