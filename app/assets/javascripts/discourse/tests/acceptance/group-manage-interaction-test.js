import {
  acceptance,
  count,
  updateCurrentUser,
} from "discourse/tests/helpers/qunit-helpers";
import selectKit from "discourse/tests/helpers/select-kit-helper";
import { test } from "qunit";
import { visit } from "@ember/test-helpers";

acceptance("Managing Group Interaction Settings", function (needs) {
  needs.user();
  needs.settings({ email_in: true });

  test("As an admin", async function (assert) {
    updateCurrentUser({
      moderator: false,
      admin: true,
      can_create_group: true,
    });

    await visit("/g/alternative-group/manage/interaction");

    assert.strictEqual(
      count(".groups-form-visibility-level"),
      1,
      "it should display visibility level selector"
    );

    assert.strictEqual(
      count(".groups-form-mentionable-level"),
      1,
      "it should display mentionable level selector"
    );

    assert.strictEqual(
      count(".groups-form-messageable-level"),
      1,
      "it should display messageable level selector"
    );

    assert.strictEqual(
      count(".groups-form-incoming-email"),
      1,
      "it should display incoming email input"
    );

    assert.strictEqual(
      count(".groups-form-default-notification-level"),
      1,
      "it should display default notification level input"
    );
  });

  test("As a group owner", async function (assert) {
    updateCurrentUser({
      moderator: false,
      admin: false,
      can_create_group: false,
    });

    await visit("/g/discourse/manage/interaction");

    assert.strictEqual(
      count(".groups-form-visibility-level"),
      0,
      "it should not display visibility level selector"
    );

    assert.strictEqual(
      count(".groups-form-mentionable-level"),
      1,
      "it should display mentionable level selector"
    );

    assert.strictEqual(
      count(".groups-form-messageable-level"),
      1,
      "it should display messageable level selector"
    );

    assert.strictEqual(
      count(".groups-form-incoming-email"),
      0,
      "it should not display incoming email input"
    );

    assert.strictEqual(
      count(".groups-form-default-notification-level"),
      1,
      "it should display default notification level input"
    );
  });
});

acceptance(
  "Managing Group Interaction Settings - Notification Levels",
  function (needs) {
    needs.user({ admin: true });

    test("For a group with a default_notification_level of 0", async function (assert) {
      await visit("/g/alternative-group/manage/interaction");

      await assert.ok(exists(".groups-form"), "should have the form");
      await assert.strictEqual(
        selectKit(".groups-form-default-notification-level").header().value(),
        "0",
        "it should select Muted as the notification level"
      );
    });

    test("For a group with a null default_notification_level", async function (assert) {
      await visit("/g/discourse/manage/interaction");

      await assert.ok(exists(".groups-form"), "should have the form");
      await assert.strictEqual(
        selectKit(".groups-form-default-notification-level").header().value(),
        "3",
        "it should select Watching as the notification level"
      );
    });

    test("For a group with a selected default_notification_level", async function (assert) {
      await visit("/g/support/manage/interaction");

      await assert.ok(exists(".groups-form"), "should have the form");
      await assert.strictEqual(
        selectKit(".groups-form-default-notification-level").header().value(),
        "2",
        "it should select Tracking as the notification level"
      );
    });
  }
);
