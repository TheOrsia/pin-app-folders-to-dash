import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import Shell from 'gi://Shell';
import St from 'gi://St';

import * as AppDisplay from 'resource:///org/gnome/shell/ui/appDisplay.js';
import * as AppFavorites from 'resource:///org/gnome/shell/ui/appFavorites.js';
import * as BoxPointer from 'resource:///org/gnome/shell/ui/boxpointer.js';
import * as Dash from 'resource:///org/gnome/shell/ui/dash.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';

import {Extension, gettext as _} from
    'resource:///org/gnome/shell/extensions/extension.js';

let originalEnsurePlaceholder;
let originalLoadApps;
let originalInitFolderIcon;
let originalUpdateName;
let originalReload;
let originalAddFavorite;
let originalAddFavoriteAtPos;
let originalRemoveFavorite;
let originalGetAppFromSource;
let originalCreateAppItem;

const appFolders = {};


function getFolderName(folder) {
    const name = folder.get_string('name');

    if (folder.get_boolean('translate')) {
        const translated = Shell.util_get_translated_folder_name(name);
        if (translated !== null)
            return translated;
    }

    return name;
}


function lookupAppFolder(id) {
    if (!appFolders[id]) {
        appFolders[id] = new String(id);
        appFolders[id].is_window_backed = () => false;
        appFolders[id].get_id = () => id;
    }

    return appFolders[id];
}


function ensurePlaceholder(source) {
    if (source instanceof AppDisplay.AppIcon) {
        originalEnsurePlaceholder.call(this, source);
        return;
    }

    if (this._placeholder)
        return;

    const id = source.id;
    const path = `${this._folderSettings.path}folders/${id}/`;

    this._placeholder = new AppDisplay.FolderIcon(id, path, this);

    this._placeholder.connect('notify::pressed', icon => {
        if (icon.pressed && typeof this.updateDragFocus === 'function')
            this.updateDragFocus(icon);
    });

    this._placeholder.scaleAndFade();
    this._redisplay();
}


function loadApps() {
    const appIcons = originalLoadApps.call(this);
    const appFavorites = AppFavorites.getAppFavorites();

    const filteredFolderIcons = this._folderIcons.filter(
        icon => !appFavorites.isFavorite(icon._id));

    this._folderIcons.forEach(icon => {
        if (appFavorites.isFavorite(icon._id)) {
            const index = appIcons.indexOf(icon);
            if (index !== -1)
                appIcons.splice(index, 1);

            icon.destroy();
        }
    });

    this._folderIcons = filteredFolderIcons;

    return appIcons;
}


function initFolderIcon(id, path, parentView) {
    originalInitFolderIcon.call(this, id, path, parentView);

    this.app = lookupAppFolder(id);

    this.connect('button-press-event', (actor, event) => {
        if (event.get_button() === 3) {
            popupMenu.call(this);
            return Clutter.EVENT_STOP;
        }

        return Clutter.EVENT_PROPAGATE;
    });

    this._menuManager = new PopupMenu.PopupMenuManager(this);
}


function popupMenu() {
    this.setForcedHighlight(true);
    this.fake_release();

    if (!this._menu) {
        const appFavorites = AppFavorites.getAppFavorites();
        const isFavorite = appFavorites.isFavorite(this._id);
        const side = isFavorite ? St.Side.BOTTOM : St.Side.LEFT;
        const label = isFavorite ? _('Unpin') : _('Pin to Dash');
        const id = this._id;

        this._menu = new PopupMenu.PopupMenu(this, 0.5, side);

        this._menu.addAction(label, () => {
            GLib.idle_add(GLib.PRIORITY_DEFAULT, () => {
                if (isFavorite)
                    appFavorites.removeFavorite(id);
                else
                    appFavorites.addFavorite(id);

                return GLib.SOURCE_REMOVE;
            });
        });

        this._menu.connect('open-state-changed', (menu, isPoppedUp) => {
            if (!isPoppedUp)
                this.setForcedHighlight(false);
        });

        Main.overview.connectObject('hiding', () => {
            this._menu.close();
        }, this);

        Main.uiGroup.add_child(this._menu.actor);
        this._menuManager.addMenu(this._menu);
    }

    this._menu.open(BoxPointer.PopupAnimation.FULL);

    const item = this.get_parent();
    if (item instanceof Dash.DashItemContainer) {
        const controls = Main.overview._overview.controls;
        controls.dash._syncLabel(item, this);
    }
}


function updateName() {
    const item = this.get_parent();

    if (item instanceof Dash.DashItemContainer) {
        this._name = getFolderName(this._folder);
        item.setLabelText(this._name);
    } else {
        originalUpdateName.call(this);
    }
}


function reload() {
    originalReload.call(this);

    const appDisplay = Main.overview._overview.controls.appDisplay;
    const folders = appDisplay._folderSettings.get_strv('folder-children');
    const ids = global.settings.get_strv(this.FAVORITE_APPS_KEY);

    this._favorites = {};

    ids.forEach(id => {
        const app = Shell.AppSystem.get_default().lookup_app(id);

        if (app !== null &&
            this._parentalControlsManager.shouldShowApp(app.app_info)) {
            this._favorites[app.get_id()] = app;
        } else if (folders.includes(id)) {
            this._favorites[id] = lookupAppFolder(id);
        }
    });
}


function addFavorite(appId, pos) {
    const appDisplay = Main.overview._overview.controls.appDisplay;
    const folders = appDisplay._folderSettings.get_strv('folder-children');

    if (!folders.includes(appId))
        return originalAddFavorite.call(this, appId, pos);

    if (appId in this._favorites)
        return false;

    const ids = this._getIds();
    ids.splice(pos === -1 ? ids.length : pos, 0, appId);

    global.settings.set_strv(this.FAVORITE_APPS_KEY, ids);

    return true;
}


function addFavoriteAtPos(appId, pos) {
    const appDisplay = Main.overview._overview.controls.appDisplay;
    const folders = appDisplay._folderSettings.get_strv('folder-children');

    if (!folders.includes(appId))
        return originalAddFavoriteAtPos.call(this, appId, pos);

    if (!this._addFavorite(appId, pos))
        return;

    const path = `${appDisplay._folderSettings.path}folders/${appId}/`;
    const folder = new Gio.Settings({
        schema_id: 'org.gnome.desktop.app-folders.folder',
        path,
    });

    getFolderName(folder);
}


function removeFavorite(appId) {
    const appDisplay = Main.overview._overview.controls.appDisplay;
    const folders = appDisplay._folderSettings.get_strv('folder-children');

    if (!folders.includes(appId))
        return originalRemoveFavorite.call(this, appId);

    if (!this._removeFavorite(appId))
        return;

    const path = `${appDisplay._folderSettings.path}folders/${appId}/`;
    const folder = new Gio.Settings({
        schema_id: 'org.gnome.desktop.app-folders.folder',
        path,
    });

    getFolderName(folder);
}


function getAppFromSource(source) {
    if (source instanceof AppDisplay.FolderIcon)
        return source.app;

    return originalGetAppFromSource.call(this, source);
}


function hookUpFolderLabel(dash, item, appIcon) {
    item.child.connect('notify::hover', () => {
        if (item.child.hover)
            dash._syncLabel(item, appIcon);
        else
            item.hideLabel();
    });

    const id = Main.overview.connect('hiding', () => {
        dash._labelShowing = false;
        item.hideLabel();
    });

    item.child.connect('destroy', () => {
        Main.overview.disconnect(id);
    });
}


function createAppItem(app) {
    if (app instanceof Shell.App)
        return originalCreateAppItem.call(this, app);

    const appDisplay = Main.overview._overview.controls.appDisplay;
    const id = app.toString();
    const path = `${appDisplay._folderSettings.path}folders/${id}/`;

    const appIcon = new AppDisplay.FolderIcon(id, path, appDisplay);

    appIcon.connect('apps-changed', () => {
        appDisplay._redisplay();
        appDisplay._savePages();
        appIcon.view._redisplay();
    });

    const item = new Dash.DashItemContainer();
    item.setChild(appIcon);

    const folderLabel = appIcon.icon.label;
    if (folderLabel && folderLabel.get_parent())
        folderLabel.get_parent().remove_child(folderLabel);

    appIcon.label_actor = null;
    appIcon.icon.label = null;

    appIcon.icon.style_class = 'overview-icon';
    appIcon.icon.setIconSize(this.iconSize);
    appIcon.icon.y_align = Clutter.ActorAlign.CENTER;

    item.setLabelText(getFolderName(appIcon._folder));

    appIcon.shouldShowTooltip = () =>
        appIcon.hover && (!appIcon._menu || !appIcon._menu.isOpen);

    hookUpFolderLabel(this, item, appIcon);

    return item;
}


function redisplayIcons() {
    AppFavorites.getAppFavorites().reload();

    const controls = Main.overview._overview.controls;
    const appDisplay = controls.appDisplay;
    const apps = appDisplay._orderedItems.slice();

    apps.forEach(icon => appDisplay._removeItem(icon));

    appDisplay._redisplay();
    controls.dash._queueRedisplay();
}


export default class PinFoldersToDashExtension extends Extension {
    enable() {
        const appDisplayClass = AppDisplay.AppDisplay;

        originalEnsurePlaceholder = appDisplayClass.prototype._ensurePlaceholder;
        appDisplayClass.prototype._ensurePlaceholder = ensurePlaceholder;

        originalLoadApps = appDisplayClass.prototype._loadApps;
        appDisplayClass.prototype._loadApps = loadApps;

        originalInitFolderIcon = AppDisplay.FolderIcon.prototype._init;
        AppDisplay.FolderIcon.prototype._init = initFolderIcon;

        originalUpdateName = AppDisplay.FolderIcon.prototype._updateName;
        AppDisplay.FolderIcon.prototype._updateName = updateName;

        const appFavoritesClass = AppFavorites.getAppFavorites().constructor;

        originalAddFavorite = appFavoritesClass.prototype._addFavorite;
        appFavoritesClass.prototype._addFavorite = addFavorite;

        originalAddFavoriteAtPos = appFavoritesClass.prototype.addFavoriteAtPos;
        appFavoritesClass.prototype.addFavoriteAtPos = addFavoriteAtPos;

        originalRemoveFavorite = appFavoritesClass.prototype.removeFavorite;
        appFavoritesClass.prototype.removeFavorite = removeFavorite;

        originalReload = appFavoritesClass.prototype.reload;
        appFavoritesClass.prototype.reload = reload;

        originalGetAppFromSource = Dash.Dash.getAppFromSource;
        Dash.Dash.getAppFromSource = getAppFromSource;

        originalCreateAppItem = Dash.Dash.prototype._createAppItem;
        Dash.Dash.prototype._createAppItem = createAppItem;

        redisplayIcons();
    }

    disable() {
        const appDisplayClass = AppDisplay.AppDisplay;

        appDisplayClass.prototype._ensurePlaceholder = originalEnsurePlaceholder;
        appDisplayClass.prototype._loadApps = originalLoadApps;

        AppDisplay.FolderIcon.prototype._init = originalInitFolderIcon;
        AppDisplay.FolderIcon.prototype._updateName = originalUpdateName;

        const appFavoritesClass = AppFavorites.getAppFavorites().constructor;

        appFavoritesClass.prototype._addFavorite = originalAddFavorite;
        appFavoritesClass.prototype.addFavoriteAtPos = originalAddFavoriteAtPos;
        appFavoritesClass.prototype.removeFavorite = originalRemoveFavorite;
        appFavoritesClass.prototype.reload = originalReload;

        Dash.Dash.getAppFromSource = originalGetAppFromSource;
        Dash.Dash.prototype._createAppItem = originalCreateAppItem;

        redisplayIcons();
    }
}
