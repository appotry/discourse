import { module, test } from "qunit";
import Site from "discourse/models/site";
import createStore from "discourse/tests/helpers/create-store";

module("Unit | Model | site", function () {
  test("create", function (assert) {
    assert.ok(Site.create(), "it can create with no parameters");
  });

  test("instance", function (assert) {
    const site = Site.current();

    assert.present(site, "We have a current site singleton");
    assert.present(
      site.get("categories"),
      "The instance has a list of categories"
    );
    assert.present(
      site.get("flagTypes"),
      "The instance has a list of flag types"
    );
    assert.present(
      site.get("trustLevels"),
      "The instance has a list of trust levels"
    );
  });

  test("create categories", function (assert) {
    const store = createStore();
    const site = store.createRecord("site", {
      categories: [
        { id: 1234, name: "Test" },
        { id: 3456, name: "Test Subcategory", parent_category_id: 1234 },
        { id: 3458, name: "Invalid Subcategory", parent_category_id: 6666 },
      ],
    });

    const categories = site.get("categories");
    site.get("sortedCategories");

    assert.present(categories, "The categories are present");
    assert.strictEqual(categories.length, 3, "it loaded all three categories");

    const parent = categories.findBy("id", 1234);
    assert.present(parent, "it loaded the parent category");
    assert.blank(parent.get("parentCategory"), "it has no parent category");

    assert.strictEqual(parent.get("subcategories").length, 1);

    const subcategory = categories.findBy("id", 3456);
    assert.present(subcategory, "it loaded the subcategory");
    assert.strictEqual(
      subcategory.get("parentCategory"),
      parent,
      "it has associated the child with the parent"
    );

    // remove invalid category and child
    categories.removeObject(categories[2]);
    categories.removeObject(categories[1]);

    assert.strictEqual(
      categories.length,
      site.get("categoriesByCount").length,
      "categories by count should change on removal"
    );
    assert.strictEqual(
      categories.length,
      site.get("sortedCategories").length,
      "sorted categories should change on removal"
    );
  });
});
