import {Component, OnInit} from '@angular/core';
import {ICourse} from '../../../../../../../shared/models/ICourse';
import {MatDialog} from '@angular/material';
import {SnackBarService} from '../../../shared/services/snack-bar.service';
import {CourseService, MediaService} from '../../../shared/services/data.service';
import {ActivatedRoute} from '@angular/router';
import {IDirectory} from '../../../../../../../shared/models/mediaManager/IDirectory';
import {UploadFormDialog} from '../../../shared/components/upload-form-dialog/upload-form-dialog.component';
import {IFile} from '../../../../../../../shared/models/mediaManager/IFile';
import {DialogService} from '../../../shared/services/dialog.service';
import {RenameDialogComponent} from '../../../shared/components/rename-dialog/rename-dialog.component';
import {FileIconService} from '../../../shared/services/file-icon.service';

@Component({
  selector: 'app-course-mediamanager',
  templateUrl: './course-media.component.html',
  styleUrls: ['./course-media.component.scss']
})
export class CourseMediaComponent implements OnInit {
  course: ICourse;
  folderBarVisible: boolean;
  currentFolder: IDirectory;
  selectedFiles: IFile[] = [];
  toggleBlocked = false;

  constructor(public dialog: MatDialog,
              private mediaService: MediaService,
              public dialogService: DialogService,
              private courseService: CourseService,
              private route: ActivatedRoute,
              private snackBar: SnackBarService,
              private fileIcon: FileIconService) {
  }

  async ngOnInit() {
    this.folderBarVisible = false;

    this.route.parent.params.subscribe(async (params) => {
      try {
        // retrieve course
        this.course = await this.courseService.readCourseToEdit(params['id']);

        // Check if course has root dir
        if (this.course.media === undefined) {
          // Root dir does not exist, add one
          this.course.media = await this.mediaService.createRootDir(this.course.name);
          // Update course
          await this.courseService.updateItem<ICourse>(this.course);
          // Reload course
          this.course = await this.courseService.readCourseToEdit(this.course._id);
        }

        await this.changeDirectory(this.course.media._id, true);
      } catch (err) {
        this.snackBar.open(err.error.message);
      }
    });
  }

  async reloadDirectory() {
    await this.changeDirectory(this.currentFolder._id, true);
  }

  async changeDirectory(mediaId: string, lazy: boolean = false) {
    // Set current dir
    this.currentFolder = await this.mediaService.getDirectory(mediaId, lazy);

    // Define Sort function to sort by name
    const sortFnc = (a, b): number => {
      const aName = a.name.toLowerCase();
      const bName = b.name.toLowerCase();

      if (aName < bName) {
        return -1;
      } else if (aName > bName) {
        return 1;
      }
      return 0;
    };

    // Sort files by name
    this.currentFolder.files.sort(sortFnc);

    // Sort subdirs by name
    this.currentFolder.subDirectories.sort(sortFnc);
  }

  toggleFolderBarVisibility(): void {
    this.folderBarVisible = !this.folderBarVisible;
  }

  addFile(): void {
    // TODO: Dialog can grow to high; implement scroll
    const dialogRef = this.dialog.open(UploadFormDialog, {
      maxHeight: '90vh',
      minWidth: '50vw',
      data: {
        targetDir: this.currentFolder,
      },
    });

    dialogRef.afterClosed().subscribe(value => {
      if (value) {
        // Reload current folder
        this.reloadDirectory();
      }
    });
  }

  isInSelectedFiles(file: IFile) {
    return this.selectedFiles.indexOf(file) !== -1;
  }

  toggleSelection(file: IFile) {
    if (this.toggleBlocked) {
      return;
    }
    const position = this.selectedFiles.indexOf(file);
    if (position !== -1) {
      this.selectedFiles.splice(position, 1);
    } else {
      this.selectedFiles.push(file);
    }
  }

  /**
   * Remove selected files when user confirms
   * @returns {Promise<void>}
   */
  async removeSelectedFile() {
    this.toggleBlocked = true;

    const deleteSelectedFiles = await this.dialogService
      .confirmRemove('selected files', '', 'course')
      .toPromise();

    if (deleteSelectedFiles === false) {
      return;
    }

    const filesFailed = [];
    for (const file of this.selectedFiles) {
      try {
        await this.mediaService.deleteFile(file);
      } catch (err) {
        filesFailed.push(file.name);
      }
    }

    if (filesFailed.length === 0) {
      this.snackBar.open('Removed all selected files');
    } else {
      this.snackBar.openLong('Could not remove: ' + filesFailed.join(', '));
    }

    this.selectedFiles = [];
    await this.reloadDirectory();
    this.toggleBlocked = false;
  }

  initFileDownload(file: IFile) {
    const url = '/api/uploads/' + file.link;
    window.open(url, '_blank');
    this.toggleSelection(file);
  }

  async renameFile(file: IFile) {
    const res = await this.dialog.open(RenameDialogComponent, {
      minWidth: '30%',
      data: {
        name: file.name,
      }
    });

    res.afterClosed().subscribe(async value => {
      if (value !== undefined && value !== false) {
        // Update file attributes
        file.name = value;
        await this.mediaService.updateFile(file)
          .then(value2 => this.snackBar.open('Renamed file'))
          .catch(reason => this.snackBar.open('Rename failed, Server error'));
        await this.reloadDirectory();
      }
    });
  }
}
